/**
 * Diagnostic: inspect reward signal breakdown.
 *
 * Runs evaluation with a recording wrapper that captures per-tick reward data.
 * Shows what the RL training pipeline would see: events, segment triggers,
 * reward distribution, and alignment with fitness.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

import {
  type AgentFn,
  createGameAgent,
  DEFAULT_HEXAGONOIDS_ENVIRONMENT_CONFIG,
  DEFAULT_REWARD_CONFIG,
  doNothingAgent,
  type GameAgent,
  type GauntletBreakdown,
  HexagonoidsEnvironment,
  METRIC_EPISODE_FITNESS,
  METRIC_GAUNTLET_BREAKDOWN,
  mergeConfig,
  type RewardConfig,
  randomAgent,
} from '@heygrady/hexagonoids-environment'
import type { PartialEvaluationContext } from '@neat-evolution/execution-manager'
import type {
  StepAgent,
  StepEpisodeInfo,
  StepEpisodeResult,
  StepOutcome,
} from '@neat-evolution/rl-core'
import { createVanillaStepAgent } from '@neat-evolution/rl-core'
import { createMemoryRecorder } from '@neat-evolution/stats'
import { createRNG } from '@neat-evolution/utils'
import { loadScenarioBank } from '../../data/scenarios.js'
import { defaultProfile } from '../profiles/index.js'
import type { SupportedAlgorithm } from '../registries/algorithmRegistry.js'
import { hydrateToExecutor } from '../registries/hydrateGenome.js'

// ── Package root for artifact discovery ──
const PACKAGE_ROOT = resolve(new URL('.', import.meta.url).pathname, '../../..')

// ── Types ──

export interface InspectRewardsOptions {
  scenariosPerOrganism: number
  scenarioMaxTicks: number
  seed: string
  dtMs: number
  curriculum: boolean
  curriculumCount: number
  scenarioWeight: number
  fullGameWeight: number
  curriculumWeight: number
  maxTicks: number
  fullGameSeeds: number
  genome: string | undefined
  lab: string | undefined
  method: string
  rewardConfig: RewardConfig
}

export function defaultInspectRewardsOptions(): InspectRewardsOptions {
  const pc = (defaultProfile.config ?? {}) as Record<string, unknown>
  const envDefaults = DEFAULT_HEXAGONOIDS_ENVIRONMENT_CONFIG
  const sim = envDefaults.simulation

  return {
    scenariosPerOrganism:
      (pc.scenariosPerOrganism as number | undefined) ?? 100,
    scenarioMaxTicks: (pc.scenarioMaxTicks as number | undefined) ?? 60,
    seed: 'inspect-rewards-001',
    dtMs: (pc.dtMs as number | undefined) ?? sim.dtMs,
    curriculum: (pc.curriculumEnabled as boolean | undefined) ?? false,
    curriculumCount:
      (pc.curriculumCount as number | undefined) ?? sim.curriculumCount,
    scenarioWeight:
      (pc.scenarioWeight as number | undefined) ?? envDefaults.scenarioWeight,
    fullGameWeight:
      (pc.fullGameWeight as number | undefined) ?? envDefaults.fullGameWeight,
    curriculumWeight:
      (pc.curriculumWeight as number | undefined) ??
      envDefaults.curriculumWeight,
    maxTicks: (pc.maxTicks as number | undefined) ?? sim.maxTicks,
    fullGameSeeds: (pc.fullGameSeedsPerOrganism as number | undefined) ?? 4,
    genome: undefined,
    lab: undefined,
    method: (pc.method as string | undefined) ?? 'HyperNEAT',
    rewardConfig: { ...DEFAULT_REWARD_CONFIG },
  }
}

// ── Reward recording ──

interface RewardTick {
  tick: number
  reward: number
  terminated: boolean
  truncated: boolean
  isInteresting: boolean
}

interface EpisodeRewardData {
  episodeIndex: number
  type: string
  ticks: RewardTick[]
  totalReward: number
  kills: number
  deaths: number
  discountedReturn: number
}

const DISCOUNT_FACTOR = 0.99
const THRESHOLD = 0.1

function computeDiscountedReturn(rewards: number[]): number {
  let g = 0
  for (let t = rewards.length - 1; t >= 0; t--) {
    g = (rewards[t] ?? 0) + DISCOUNT_FACTOR * g
  }
  return g
}

interface RewardRecorderState {
  episodes: EpisodeRewardData[]
  currentEpisode: EpisodeRewardData | null
  currentTick: number
  pendingInteresting: boolean
}

function createRewardRecorderState(): RewardRecorderState {
  return {
    episodes: [],
    currentEpisode: null,
    currentTick: 0,
    pendingInteresting: false,
  }
}

function recordObservation(state: RewardRecorderState): void {
  state.currentTick += 1
}

function startRecordedEpisode(
  state: RewardRecorderState,
  info: StepEpisodeInfo
): void {
  state.currentTick = 0
  state.pendingInteresting = false
  state.currentEpisode = {
    episodeIndex: info.episodeIndex ?? state.episodes.length,
    type: (info.type as string) ?? 'unknown',
    ticks: [],
    totalReward: 0,
    kills: 0,
    deaths: 0,
    discountedReturn: 0,
  }
}

function completeRecordedStep(
  state: RewardRecorderState,
  outcome: StepOutcome,
  rewardConfig: RewardConfig
): void {
  const currentEpisode = state.currentEpisode
  if (currentEpisode == null) return

  const r = outcome.reward
  const isKill = rewardConfig.rockReward > 0 && r >= rewardConfig.rockReward
  const isDeath =
    rewardConfig.deathPenalty < 0 && r <= rewardConfig.deathPenalty
  if (isKill) currentEpisode.kills += 1
  if (isDeath) currentEpisode.deaths += 1
  currentEpisode.totalReward += r
  currentEpisode.ticks.push({
    tick: state.currentTick,
    reward: r,
    terminated: outcome.terminated,
    truncated: outcome.truncated,
    isInteresting:
      (outcome.info as Record<string, unknown> | undefined)?.isInteresting ===
        true || state.pendingInteresting,
  })
  state.pendingInteresting = false
}

function endRecordedEpisode(
  state: RewardRecorderState,
  _result: StepEpisodeResult
): void {
  const currentEpisode = state.currentEpisode
  if (currentEpisode == null) return

  currentEpisode.discountedReturn = computeDiscountedReturn(
    currentEpisode.ticks.map((tick) => tick.reward)
  )
  state.episodes.push(currentEpisode)
  state.currentEpisode = null
}

function createRecordingWrapper(
  inner: StepAgent,
  rewardConfig: RewardConfig
): {
  agent: StepAgent
  getEpisodes(): EpisodeRewardData[]
} {
  const state = createRewardRecorderState()

  const agent: StepAgent = {
    act(inputs: Float64Array): Float64Array {
      recordObservation(state)
      return inner.act(inputs)
    },
    completeStep(outcome: StepOutcome): void {
      completeRecordedStep(state, outcome, rewardConfig)
      inner.completeStep(outcome)
    },
    startEpisode(info: StepEpisodeInfo): void {
      startRecordedEpisode(state, info)
      inner.startEpisode(info)
    },
    endEpisode(result: StepEpisodeResult): void {
      endRecordedEpisode(state, result)
      inner.endEpisode(result)
    },
  }

  return { agent, getEpisodes: () => state.episodes }
}

function createBaselineRecordingWrapper(rewardConfig: RewardConfig): {
  agent: StepAgent
  getEpisodes(): EpisodeRewardData[]
  recordObservation(observation: Float64Array): void
} {
  const state = createRewardRecorderState()

  const agent: StepAgent = {
    act(): Float64Array {
      throw new Error('Baseline recording wrapper act() should not be called')
    },
    completeStep(outcome: StepOutcome): void {
      completeRecordedStep(state, outcome, rewardConfig)
    },
    startEpisode(info: StepEpisodeInfo): void {
      startRecordedEpisode(state, info)
    },
    endEpisode(result: StepEpisodeResult): void {
      endRecordedEpisode(state, result)
    },
  }

  return {
    agent,
    getEpisodes: () => state.episodes,
    recordObservation(_observation: Float64Array): void {
      recordObservation(state)
    },
  }
}

// ── Lab discovery ──

function findMostRecentLab(): string | null {
  const labRoot = resolve(PACKAGE_ROOT, '.artifacts/lab')
  if (!existsSync(labRoot)) return null
  const entries = readdirSync(labRoot, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort()
  for (let i = entries.length - 1; i >= 0; i--) {
    const dir = join(labRoot, entries[i] as string)
    const hasBest = readdirSync(dir).some((f) => /^best-.+\.json$/.test(f))
    if (hasBest) return dir
  }
  return null
}

interface LabGenome {
  label: string
  genomePath: string
  method: string
}

function discoverLabGenomes(labDir: string): LabGenome[] {
  const results: LabGenome[] = []

  const configPath = join(labDir, 'config.json')
  let method = 'HyperNEAT'
  if (existsSync(configPath)) {
    const config = JSON.parse(readFileSync(configPath, 'utf-8'))
    method = config.trainOptions?.method ?? config.method ?? 'HyperNEAT'
  }

  const bestPath = join(labDir, `best-${method}.json`)
  if (existsSync(bestPath)) {
    results.push({ label: 'best', genomePath: bestPath, method })
  }

  const genomesDir = join(labDir, 'genomes')
  if (existsSync(genomesDir)) {
    const genFiles = readdirSync(genomesDir)
      .filter((f) => /^gen-\d+\.json$/.test(f))
      .sort()
    if (genFiles.length > 0) {
      const indices = new Set<number>()
      const count = Math.min(5, genFiles.length)
      for (let i = 0; i < count; i++) {
        indices.add(Math.round((i * (genFiles.length - 1)) / (count - 1)))
      }
      for (const idx of [...indices].sort((a, b) => a - b)) {
        const file = genFiles[idx] as string
        const genNum = file.replace('gen-', '').replace('.json', '')
        results.push({
          label: `gen-${genNum}`,
          genomePath: join(genomesDir, file),
          method,
        })
      }
    }
  }

  return results
}

// ── Agent entries ──

interface ExecutorEntry {
  name: string
  type: 'executor'
  genomePath: string
  method: SupportedAlgorithm
}

interface BaselineEntry {
  name: string
  type: 'baseline'
  agentFn: AgentFn
}

type AgentEntry = ExecutorEntry | BaselineEntry

// ── Formatting helpers ──

function pad(str: string | number, len: number): string {
  return String(str).padEnd(len)
}
function fmtNum(n: number, decimals = 4): string {
  return n.toFixed(decimals)
}

// ── Evaluate one agent with reward recording ──

function evaluateWithRewardRecording(
  environment: HexagonoidsEnvironment,
  entry: AgentEntry,
  seed: string,
  rewardConfig: RewardConfig
): {
  fitness: number
  breakdown: GauntletBreakdown
  episodes: EpisodeRewardData[]
} {
  const recorder = createMemoryRecorder([
    METRIC_GAUNTLET_BREAKDOWN,
    METRIC_EPISODE_FITNESS,
  ])
  const rng = createRNG(seed)
  const context: PartialEvaluationContext = { rng, stats: recorder }
  let fitness: number
  let getEpisodes: () => EpisodeRewardData[]

  if (entry.type === 'executor') {
    const executor = hydrateToExecutor(entry.genomePath, entry.method)
    const innerAgent = createVanillaStepAgent(executor)
    const wrapped = createRecordingWrapper(innerAgent, rewardConfig)
    fitness = environment.evaluateStepAgent(wrapped.agent, context)
    getEpisodes = wrapped.getEpisodes
  } else {
    const bridge = createGameAgent({
      act(): Float64Array {
        throw new Error('Baseline observe bridge act() should not be called')
      },
    })
    const wrapped = createBaselineRecordingWrapper(rewardConfig)
    const gameAgent: GameAgent = {
      agent(state, playerId, agentContext) {
        wrapped.recordObservation(bridge.observe(state, playerId, agentContext))
        return entry.agentFn(state, playerId, agentContext)
      },
      observe: bridge.observe,
      resetMemory: bridge.resetMemory,
    }
    fitness = environment.evaluateGameAgent(gameAgent, context, wrapped.agent)
    getEpisodes = wrapped.getEpisodes
  }

  const breakdowns = recorder.get<GauntletBreakdown>(METRIC_GAUNTLET_BREAKDOWN)
  if (breakdowns.length === 0) {
    throw new Error(`No gauntlet breakdown recorded for agent "${entry.name}"`)
  }

  return {
    fitness,
    breakdown: breakdowns[0] as GauntletBreakdown,
    episodes: getEpisodes(),
  }
}

// ── Main ──

export async function runInspectRewards(
  options: InspectRewardsOptions
): Promise<void> {
  const pc = (defaultProfile.config ?? {}) as Record<string, unknown>

  const profileGateConfig =
    (pc.gateConfig as Record<string, unknown> | undefined) ?? {}

  const envConfig = mergeConfig({
    simulation: {
      scenariosPerOrganism: options.scenariosPerOrganism,
      scenarioMaxTicks: options.scenarioMaxTicks,
      maxTicks: options.maxTicks,
      dtMs: options.dtMs,
      curriculumEnabled: options.curriculum,
      curriculumCount: options.curriculumCount,
    },
    fitnessWeights: pc.fitnessWeights as Record<string, number> | undefined,
    gateConfig: profileGateConfig,
    scenarioWeight: options.scenarioWeight,
    fullGameWeight: options.fullGameWeight,
    curriculumWeight: options.curriculumWeight,
    fullGameSeedsPerOrganism: options.fullGameSeeds,
  } as unknown as Parameters<typeof mergeConfig>[0])

  const scenarioBank = await loadScenarioBank()
  const rewardConfig = options.rewardConfig

  console.log(`\n=== Reward Inspection ===`)
  console.log(
    `scenariosPerOrganism=${envConfig.simulation.scenariosPerOrganism} scenarioMaxTicks=${envConfig.simulation.scenarioMaxTicks} seed="${options.seed}"`
  )
  console.log(`Bank size: ${scenarioBank.length}`)
  console.log(
    `Reward config: rockReward=${rewardConfig.rockReward} deathPenalty=${rewardConfig.deathPenalty} survivalReward=${rewardConfig.survivalReward} scoreScale=${rewardConfig.scoreScale} shotPenalty=${rewardConfig.shotPenalty}`
  )
  console.log(
    `Reward threshold: ${THRESHOLD}  Discount factor: ${DISCOUNT_FACTOR}`
  )
  console.log()

  const environment = new HexagonoidsEnvironment({
    ...envConfig,
    scenarioBank,
  })

  const agents: AgentEntry[] = [
    { name: 'doNothing', type: 'baseline', agentFn: doNothingAgent },
    { name: 'random', type: 'baseline', agentFn: randomAgent },
  ]

  // Auto-discover lab genomes
  if (!options.genome) {
    const labDir = options.lab ? resolve(options.lab) : findMostRecentLab()
    if (labDir) {
      const labGenomes = discoverLabGenomes(labDir)
      if (labGenomes.length > 0) {
        console.log(`Lab: ${labDir}`)
        console.log(`Found ${labGenomes.length} genomes`)
        for (const g of labGenomes) {
          agents.push({
            name: g.label,
            type: 'executor',
            genomePath: g.genomePath,
            method: g.method as SupportedAlgorithm,
          })
        }
        console.log()
      }
    }
  }

  if (options.genome) {
    const genomePath = resolve(options.genome)
    console.log(`Loading genome: ${genomePath}`)
    const genLabel =
      genomePath.split('/').pop()?.replace('.json', '') ?? 'genome'
    agents.push({
      name: genLabel,
      type: 'executor',
      genomePath,
      method: options.method as SupportedAlgorithm,
    })
    console.log()
  }

  interface AgentSummary {
    name: string
    fitness: number
    kills: number
    deaths: number
    meanReturn: number
    episodeCount: number
  }

  const summaries: AgentSummary[] = []

  for (const entry of agents) {
    console.log(`${'─'.repeat(60)}`)
    console.log(`Agent: ${entry.name}`)
    console.log(`${'─'.repeat(60)}`)

    const { fitness, breakdown, episodes } = evaluateWithRewardRecording(
      environment,
      entry,
      options.seed,
      rewardConfig
    )

    // Aggregate stats
    let totalKills = 0
    let totalDeaths = 0
    let totalTicks = 0
    let rewardTriggers = 0
    let doneTriggers = 0
    let infoTriggers = 0
    let ticksZero = 0
    let ticksPositive = 0
    let ticksNegative = 0
    let ticksAboveThreshold = 0
    let sumPositiveReward = 0
    let sumNegativeReward = 0
    const episodeReturns: number[] = []

    for (const ep of episodes) {
      totalKills += ep.kills
      totalDeaths += ep.deaths
      totalTicks += ep.ticks.length
      episodeReturns.push(ep.discountedReturn)

      for (const tick of ep.ticks) {
        if (Math.abs(tick.reward) > THRESHOLD) {
          rewardTriggers++
        } else if (tick.isInteresting) {
          infoTriggers++
        }
        if (tick.reward === 0) ticksZero++
        else if (tick.reward > 0) {
          ticksPositive++
          sumPositiveReward += tick.reward
        } else {
          ticksNegative++
          sumNegativeReward += tick.reward
        }
        if (Math.abs(tick.reward) > THRESHOLD) ticksAboveThreshold++
      }
      doneTriggers++
    }

    const totalTriggers = rewardTriggers + doneTriggers + infoTriggers
    const meanReturn =
      episodeReturns.length > 0
        ? episodeReturns.reduce((a, b) => a + b, 0) / episodeReturns.length
        : 0
    const variance =
      episodeReturns.length > 0
        ? episodeReturns.reduce((a, b) => a + (b - meanReturn) ** 2, 0) /
          episodeReturns.length
        : 0
    const stddevReturn = Math.sqrt(variance)

    // Episode samples (first 5 + last 2)
    const sampleIndices = new Set<number>()
    for (let i = 0; i < Math.min(5, episodes.length); i++) sampleIndices.add(i)
    if (episodes.length > 5) {
      sampleIndices.add(episodes.length - 2)
      sampleIndices.add(episodes.length - 1)
    }

    console.log(`\n=== Episode Samples ===`)
    for (const idx of sampleIndices) {
      const ep = episodes[idx]
      if (ep == null) continue
      const eventTicks = ep.ticks.filter((t) => t.reward !== 0)
      const eventStr =
        eventTicks.length > 0
          ? eventTicks
              .map((t) => {
                const label = t.reward > 0 ? 'kill' : 'death'
                return `${label}@${t.tick}(${t.reward > 0 ? '+' : ''}${fmtNum(t.reward, 1)})`
              })
              .join(' ')
          : 'no events'
      console.log(
        `  Ep ${ep.episodeIndex} (${ep.type}, ${ep.ticks.length} ticks): reward=${fmtNum(ep.totalReward, 2)}  return=${fmtNum(ep.discountedReturn, 3)}  kills=${ep.kills} deaths=${ep.deaths}`
      )
      console.log(`    events: ${eventStr}`)
    }
    if (episodes.length > 7) {
      console.log(`  ... (${episodes.length - 7} more episodes)`)
    }

    console.log(`\n=== Reward Statistics (${episodes.length} episodes) ===`)
    console.log(
      `  total events:        kills=${totalKills}  deaths=${totalDeaths}`
    )
    console.log(
      `  mean episode return: ${fmtNum(meanReturn, 3)}  stddev: ${fmtNum(stddevReturn, 3)}`
    )

    console.log(`\n=== Trigger Distribution ===`)
    if (totalTriggers > 0) {
      console.log(
        `  reward triggers:  ${rewardTriggers} (${((rewardTriggers / totalTriggers) * 100).toFixed(0)}%)    |reward| > ${THRESHOLD}`
      )
      console.log(
        `  done triggers:    ${doneTriggers} (${((doneTriggers / totalTriggers) * 100).toFixed(0)}%)    episode terminations`
      )
      console.log(
        `  info triggers:    ${infoTriggers} (${((infoTriggers / totalTriggers) * 100).toFixed(0)}%)    isInteresting below threshold`
      )
    }

    console.log(`\n=== Reward Distribution (${totalTicks} ticks) ===`)
    if (totalTicks > 0) {
      console.log(
        `  reward=0:   ${ticksZero} (${((ticksZero / totalTicks) * 100).toFixed(1)}%)`
      )
      console.log(
        `  reward>0:   ${ticksPositive} (${((ticksPositive / totalTicks) * 100).toFixed(1)}%)  mean=${ticksPositive > 0 ? fmtNum(sumPositiveReward / ticksPositive, 2) : 'n/a'}`
      )
      console.log(
        `  reward<0:   ${ticksNegative} (${((ticksNegative / totalTicks) * 100).toFixed(1)}%)  mean=${ticksNegative > 0 ? fmtNum(sumNegativeReward / ticksNegative, 2) : 'n/a'}`
      )
      console.log(
        `  above threshold: ${ticksAboveThreshold} (${((ticksAboveThreshold / totalTicks) * 100).toFixed(1)}%)`
      )
    }

    // Fitness alignment
    const fitnessRocks =
      breakdown.scenarioBreakdowns.reduce((a, b) => a + b.rocksDestroyed, 0) +
      breakdown.fullGameBreakdowns.reduce((a, b) => a + b.rocksDestroyed, 0) +
      breakdown.curriculumBreakdowns.reduce((a, b) => a + b.rocksDestroyed, 0)
    const fitnessDeaths =
      breakdown.scenarioBreakdowns.reduce((a, b) => a + b.deaths, 0) +
      breakdown.fullGameBreakdowns.reduce((a, b) => a + b.deaths, 0) +
      breakdown.curriculumBreakdowns.reduce((a, b) => a + b.deaths, 0)

    console.log(`\n=== Fitness Alignment ===`)
    console.log(`  gauntlet fitness:  ${fmtNum(fitness)}`)
    console.log(`  mean return:       ${fmtNum(meanReturn, 3)}`)
    console.log(
      `  reward kills=${totalKills}  fitness rocksDestroyed=${fitnessRocks}`
    )
    console.log(
      `  reward deaths=${totalDeaths}  fitness deaths=${fitnessDeaths}`
    )

    summaries.push({
      name: entry.name,
      fitness,
      kills: totalKills,
      deaths: totalDeaths,
      meanReturn,
      episodeCount: episodes.length,
    })
    console.log()
  }

  // Comparison table
  if (summaries.length >= 2) {
    const colWidth = 12
    const labelWidth = 18
    const columns = summaries

    console.log(`${'═'.repeat(labelWidth + 2 + columns.length * colWidth)}`)
    console.log(`  COMPARISON`)
    console.log(`${'═'.repeat(labelWidth + 2 + columns.length * colWidth)}`)
    console.log()

    const header =
      `  ${pad('Metric', labelWidth)}` +
      columns.map((c) => pad(c.name, colWidth)).join('')
    console.log(header)
    console.log(`  ${'─'.repeat(labelWidth - 2 + columns.length * colWidth)}`)

    const rows: [string, (d: AgentSummary) => string][] = [
      ['fitness', (d) => fmtNum(d.fitness)],
      ['meanReturn', (d) => fmtNum(d.meanReturn, 3)],
      ['kills', (d) => String(d.kills)],
      ['deaths', (d) => String(d.deaths)],
      ['episodes', (d) => String(d.episodeCount)],
    ]

    for (const [label, getter] of rows) {
      const line =
        `  ${pad(label, labelWidth)}` +
        columns.map((c) => pad(getter(c), colWidth)).join('')
      console.log(line)
    }
    console.log()
  }

  console.log(`${'═'.repeat(72)}`)
  console.log(`=== Done ===\n`)
}
