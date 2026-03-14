/**
 * Diagnostic: inspect fitness scoring breakdown.
 *
 * Runs evaluation with different agents (doNothing, random) and shows
 * per-component fitness breakdown including curriculum and full game scoring.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

import {
  type AgentFn,
  actionDiversityGate,
  applyBehavioralGates,
  computePossibleDeaths,
  computePossibleKills,
  createNeatAgent,
  DEFAULT_HEXAGONOIDS_ENVIRONMENT_CONFIG,
  doNothingAgent,
  mergeConfig,
  randomAgent,
  runCurriculum,
  type ScenarioSnapshot,
  simulateGame,
  simulateScenario,
  throttleGate,
  turnBiasGate,
  turnGate,
  weightedFitnessSum,
} from '@heygrady/hexagonoids-environment'
import { createExecutor, type SyncExecutor } from '@neat-evolution/executor'
import { createRNG } from '@neat-evolution/utils'
import { loadScenarioBank } from '../../data/scenarios.js'
import { loadGenome } from '../persistence/loadGenome.js'
import { defaultProfile } from '../profiles/index.js'
import {
  createGenomeFromSerialized,
  createPhenotypeForGenome,
  HEXAGONOIDS_IO,
  type SupportedAlgorithm,
} from '../registries/algorithmRegistry.js'

// ── Package root for artifact discovery ──
const PACKAGE_ROOT = resolve(new URL('.', import.meta.url).pathname, '../../..')

export interface InspectFitnessOptions {
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
  actionGateFloor: number | undefined
  turnGateFloor: number | undefined
  turnBiasGateFloor: number | undefined
}

export function defaultInspectFitnessOptions(): InspectFitnessOptions {
  const pc = (defaultProfile.config ?? {}) as Record<string, unknown>
  const envDefaults = DEFAULT_HEXAGONOIDS_ENVIRONMENT_CONFIG
  const sim = envDefaults.simulation

  return {
    scenariosPerOrganism:
      (pc.scenariosPerOrganism as number | undefined) ?? 100,
    scenarioMaxTicks: (pc.scenarioMaxTicks as number | undefined) ?? 60,
    seed: 'inspect-fitness-001',
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
    actionGateFloor: undefined,
    turnGateFloor: undefined,
    turnBiasGateFloor: undefined,
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

// ── Genome loading ──

interface AgentEntry {
  name: string
  agent: AgentFn
  executor: SyncExecutor | undefined
}

function loadGenomeAgent(
  genomePath: string,
  method: string,
  label: string
): AgentEntry {
  const serialized = loadGenome(genomePath) as {
    genome: {
      genomeOptions?: { initConfig?: unknown }
      [key: string]: unknown
    }
  }
  const genomeData = serialized.genome
  const genomeOptions = genomeData.genomeOptions
  const isRecord = (v: unknown): v is Record<string, unknown> =>
    v != null && typeof v === 'object'
  const initConfig = isRecord(genomeOptions?.initConfig)
    ? genomeOptions.initConfig
    : HEXAGONOIDS_IO

  const genome = createGenomeFromSerialized(
    method as SupportedAlgorithm,
    genomeData as unknown as Parameters<typeof createGenomeFromSerialized>[1],
    initConfig
  )
  const phenotype = createPhenotypeForGenome(
    method as SupportedAlgorithm,
    genome
  )
  const executor = createExecutor(phenotype)
  const agent = createNeatAgent()

  return { name: label, agent, executor }
}

// ── Formatting helpers ──

function pct(value: number): string {
  return `${(value * 100).toFixed(1)}%`
}
function pad(str: string | number, len: number): string {
  return String(str).padEnd(len)
}
function fmtNum(n: number, decimals = 4): string {
  return n.toFixed(decimals)
}

// ── Main ──

export async function runInspectFitness(
  options: InspectFitnessOptions
): Promise<void> {
  const pc = (defaultProfile.config ?? {}) as Record<string, unknown>

  const profileGateConfig =
    (pc.gateConfig as Record<string, unknown> | undefined) ?? {}
  const gateOverrides: Record<string, number> = {}
  if (options.actionGateFloor !== undefined)
    gateOverrides.actionGateFloor = options.actionGateFloor
  if (options.turnGateFloor !== undefined)
    gateOverrides.turnGateFloor = options.turnGateFloor
  if (options.turnBiasGateFloor !== undefined)
    gateOverrides.turnBiasGateFloor = options.turnBiasGateFloor

  const config = mergeConfig({
    simulation: {
      scenariosPerOrganism: options.scenariosPerOrganism,
      scenarioMaxTicks: options.scenarioMaxTicks,
      maxTicks: options.maxTicks,
      dtMs: options.dtMs,
    },
    fitnessWeights: pc.fitnessWeights as Record<string, number> | undefined,
    gateConfig: { ...profileGateConfig, ...gateOverrides },
  } as unknown as Parameters<typeof mergeConfig>[0])

  const scenarioBank = await loadScenarioBank()

  const { scenariosPerOrganism, scenarioMaxTicks } = config.simulation
  const weights = config.fitnessWeights
  const gc = config.gateConfig

  const fgPossibleDeaths = computePossibleDeaths(options.maxTicks, options.dtMs)

  // Normalize blending weights
  let sw = options.scenarioWeight
  let fw = options.fullGameWeight
  let cw = options.curriculum ? options.curriculumWeight : 0
  const total = sw + fw + cw
  if (total > 0) {
    sw /= total
    fw /= total
    cw /= total
  }

  console.log(`\n=== Fitness Inspection ===`)
  console.log(
    `scenariosPerOrganism=${scenariosPerOrganism} scenarioMaxTicks=${scenarioMaxTicks} seed="${options.seed}"`
  )
  console.log(`Bank size: ${scenarioBank.length}`)
  console.log(
    `Weights: rocks=${weights.rocksDestroyed} accuracy=${weights.accuracy} targetAccuracy=${weights.targetAccuracy}`
  )
  if (options.curriculum) {
    console.log(`Curriculum: enabled, count=${options.curriculumCount}`)
  }
  console.log(
    `Blending: scenario=${fmtNum(sw, 2)} fullGame=${fmtNum(fw, 2)} curriculum=${fmtNum(cw, 2)}`
  )
  console.log(
    `Full game: maxTicks=${options.maxTicks} seeds=${options.fullGameSeeds} maxPossibleDeaths=${fgPossibleDeaths} (per-seed from elapsedTicks)`
  )
  console.log()

  // Select scenarios
  const selectionRng = createRNG(options.seed)
  const selected: ScenarioSnapshot[] = []
  const count = Math.min(scenariosPerOrganism, scenarioBank.length)
  if (count >= scenarioBank.length) {
    selected.push(...scenarioBank)
  } else {
    const indices = Array.from({ length: scenarioBank.length }, (_, i) => i)
    for (let i = 0; i < count; i++) {
      const j = i + Math.floor(selectionRng.gen() * (scenarioBank.length - i))
      const temp = indices[i] as number
      indices[i] = indices[j] as number
      indices[j] = temp
      selected.push(scenarioBank[indices[i] as number] as ScenarioSnapshot)
    }
  }

  // Lives distribution
  const livesDistrib: Record<number, number> = {}
  for (const sc of selected) {
    const l = sc.player.lives ?? 3
    livesDistrib[l] = (livesDistrib[l] ?? 0) + 1
  }
  console.log(`  Starting lives distribution:`)
  for (const [lives, cnt] of Object.entries(livesDistrib).sort(
    (a, b) => Number(a[0]) - Number(b[0])
  )) {
    console.log(`    lives=${lives}: ${cnt} scenarios`)
  }
  console.log()

  const agents: AgentEntry[] = [
    { name: 'doNothing', agent: doNothingAgent, executor: undefined },
    { name: 'random', agent: randomAgent, executor: undefined },
  ]

  // Auto-discover lab genomes
  if (!options.genome) {
    const labDir = options.lab ? resolve(options.lab) : findMostRecentLab()
    if (labDir) {
      const labGenomes = discoverLabGenomes(labDir)
      if (labGenomes.length > 0) {
        const hasBest = labGenomes.some((g) => g.label === 'best')
        const sampledCount = labGenomes.filter((g) => g.label !== 'best').length
        const parts: string[] = []
        if (hasBest) parts.push('best')
        if (sampledCount > 0) parts.push(`${sampledCount} sampled generations`)
        console.log(`Lab: ${labDir}`)
        console.log(`Found ${labGenomes.length} genomes (${parts.join(' + ')})`)
        for (const g of labGenomes) {
          agents.push(loadGenomeAgent(g.genomePath, g.method, g.label))
        }
        console.log()
      }
    }
  }

  // Load explicit genome
  if (options.genome) {
    const genomePath = resolve(options.genome)
    console.log(`Loading genome: ${genomePath}`)
    console.log(`Method: ${options.method}`)
    const genLabel = genomePath.split('/').pop()!.replace('.json', '')
    agents.push(loadGenomeAgent(genomePath, options.method, genLabel))
    console.log()
  }

  interface AgentResult {
    name: string
    meanScenarioFitness: number
    meanFgFitness: number
    curriculumFitness: number
    blendedFitnessRaw: number
    blendedFitness: number
    meanPerfScore: number
    meanRocksNorm: number
    meanAccuracy: number
    meanAccuracyNorm: number
    meanSurvival: number
    meanActionGate: number
    meanTurnGate: number
    meanThrottleGate: number
    meanTurnBias: number
    aggActionGate: number
    aggTurnGate: number
    aggThrottleGate: number
    aggTurnBiasGate: number
    meanEffectiveMax: number
    meanUniqueRocksSeen: number
    meanFgSurvival: number
    meanFgThrottleGate: number
    meanFgPerfScore: number
  }

  const agentData: AgentResult[] = []

  for (const { name, agent, executor } of agents) {
    console.log(`${'─'.repeat(60)}`)
    console.log(`Agent: ${name}`)
    console.log(`${'─'.repeat(60)}`)

    const aggFrames = {
      thrustFrames: 0,
      fireFrames: 0,
      leftFrames: 0,
      rightFrames: 0,
      aliveFrames: 0,
    }

    // ── Curriculum scoring ──
    let curriculumFitness = 0
    let curriculumKills = 0
    let curriculumTotal = 0
    if (options.curriculum) {
      const metricsArray = runCurriculum(
        agent,
        options.seed,
        options.dtMs,
        options.curriculumCount,
        executor
      )
      curriculumTotal = metricsArray.length
      let currFitnessSum = 0
      for (const m of metricsArray) {
        aggFrames.thrustFrames += m.thrustFrames
        aggFrames.fireFrames += m.fireFrames
        aggFrames.leftFrames += m.leftFrames
        aggFrames.rightFrames += m.rightFrames
        aggFrames.aliveFrames += m.aliveFrames
        if (m.rocksDestroyed > 0) curriculumKills++
        currFitnessSum += weightedFitnessSum(m, weights, gc, {
          possibleDeaths: computePossibleDeaths(m.elapsedTicks, options.dtMs),
          dtMs: options.dtMs,
        })
      }
      curriculumFitness =
        metricsArray.length > 0 ? currFitnessSum / metricsArray.length : 0
    }

    // ── Scenario scoring ──
    const scenarioConfig = { ...config.simulation, maxTicks: scenarioMaxTicks }
    const perScenario: {
      fitness: number
      perfScore: number
      rocksNorm: number
      accuracy: number
      accuracyNorm: number
      survivalTerm: number
      actionGateVal: number
      turnGateVal: number
      throttleGateVal: number
      turnBiasVal: number
      rocksDestroyed: number
      uniqueRocksSeen: number
      effectiveMaxRocks: number
      deaths: number
      possibleDeaths: number
      shotsFired: number
      shotsHit: number
      aliveFrames: number
    }[] = []

    for (const scenario of selected) {
      const metrics = simulateScenario(
        agent,
        scenario,
        scenarioConfig,
        options.seed,
        executor
      )
      aggFrames.thrustFrames += metrics.thrustFrames
      aggFrames.fireFrames += metrics.fireFrames
      aggFrames.leftFrames += metrics.leftFrames
      aggFrames.rightFrames += metrics.rightFrames
      aggFrames.aliveFrames += metrics.aliveFrames
      const possibleDeaths = computePossibleDeaths(
        metrics.elapsedTicks,
        options.dtMs
      )

      const targetAccuracy =
        weights.targetAccuracy > 0 ? weights.targetAccuracy : 0.2
      const effectiveMaxRocks = computePossibleKills(
        metrics.elapsedTicks,
        options.dtMs,
        metrics.uniqueRocksSeen
      )
      const rocksNorm = Math.min(metrics.rocksDestroyed / effectiveMaxRocks, 1)

      const survivalRaw =
        possibleDeaths > 0
          ? Math.max(1 - metrics.deaths / possibleDeaths, 0)
          : 1
      const survivalTerm = Math.max(survivalRaw, gc.survivalGateFloor)

      const actionGateVal = actionDiversityGate(metrics, gc)
      const turnGateVal = turnGate(metrics, gc)
      const throttleGateVal = throttleGate(metrics, gc)
      const turnBiasVal = turnBiasGate(metrics, gc)

      const accuracyNorm = Math.min(metrics.accuracy / targetAccuracy, 1)

      const perfScore =
        weights.rocksDestroyed * rocksNorm + weights.accuracy * accuracyNorm

      const context = { possibleDeaths, dtMs: options.dtMs }
      const fitness = weightedFitnessSum(metrics, weights, gc, context)

      perScenario.push({
        fitness,
        perfScore,
        rocksNorm,
        accuracy: metrics.accuracy,
        accuracyNorm,
        survivalTerm,
        actionGateVal,
        turnGateVal,
        throttleGateVal,
        turnBiasVal,
        rocksDestroyed: metrics.rocksDestroyed,
        uniqueRocksSeen: metrics.uniqueRocksSeen,
        effectiveMaxRocks,
        deaths: metrics.deaths,
        possibleDeaths,
        shotsFired: metrics.shotsFired,
        shotsHit: metrics.shotsHit,
        aliveFrames: metrics.aliveFrames,
      })
    }

    // ── Full Game scoring ──
    const fullGameSimConfig = {
      ...config.simulation,
      maxTicks: options.maxTicks,
      useFastThrust: true,
    }
    const perFullGame = perScenario.slice(0, 0) // same shape, empty

    for (let i = 0; i < options.fullGameSeeds; i++) {
      const seed = `${options.seed}:fullgame:${i}`
      const metrics = simulateGame(agent, fullGameSimConfig, seed, executor)
      aggFrames.thrustFrames += metrics.thrustFrames
      aggFrames.fireFrames += metrics.fireFrames
      aggFrames.leftFrames += metrics.leftFrames
      aggFrames.rightFrames += metrics.rightFrames
      aggFrames.aliveFrames += metrics.aliveFrames

      const targetAccuracy =
        weights.targetAccuracy > 0 ? weights.targetAccuracy : 0.2
      const effectiveMaxRocks = computePossibleKills(
        metrics.elapsedTicks,
        options.dtMs,
        metrics.uniqueRocksSeen
      )
      const rocksNorm = Math.min(metrics.rocksDestroyed / effectiveMaxRocks, 1)

      const fgSeedPossibleDeaths = computePossibleDeaths(
        metrics.elapsedTicks,
        options.dtMs
      )
      const survivalRaw =
        fgSeedPossibleDeaths > 0
          ? Math.max(1 - metrics.deaths / fgSeedPossibleDeaths, 0)
          : 1
      const survivalTerm = Math.max(survivalRaw, gc.survivalGateFloor)

      const actionGateVal = actionDiversityGate(metrics, gc)
      const turnGateVal = turnGate(metrics, gc)
      const throttleGateVal = throttleGate(metrics, gc)
      const turnBiasVal = turnBiasGate(metrics, gc)

      const accuracyNorm = Math.min(metrics.accuracy / targetAccuracy, 1)

      const perfScore =
        weights.rocksDestroyed * rocksNorm + weights.accuracy * accuracyNorm

      const fitness = weightedFitnessSum(metrics, weights, gc, {
        possibleDeaths: fgSeedPossibleDeaths,
        dtMs: options.dtMs,
      })

      perFullGame.push({
        fitness,
        perfScore,
        rocksNorm,
        accuracy: metrics.accuracy,
        accuracyNorm,
        survivalTerm,
        actionGateVal,
        turnGateVal,
        throttleGateVal,
        turnBiasVal,
        rocksDestroyed: metrics.rocksDestroyed,
        uniqueRocksSeen: metrics.uniqueRocksSeen,
        effectiveMaxRocks,
        deaths: metrics.deaths,
        possibleDeaths: fgSeedPossibleDeaths,
        shotsFired: metrics.shotsFired,
        shotsHit: metrics.shotsHit,
        aliveFrames: metrics.aliveFrames,
      })
    }

    // ── Aggregate stats ──
    const n = perScenario.length
    const avg = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length
    const sum = (arr: number[]) => arr.reduce((a, b) => a + b, 0)

    const meanScenarioFitness = avg(perScenario.map((s) => s.fitness))
    const meanPerfScore = avg(perScenario.map((s) => s.perfScore))
    const meanRocksNorm = avg(perScenario.map((s) => s.rocksNorm))
    const meanAccuracy = avg(perScenario.map((s) => s.accuracy))
    const meanAccuracyNorm = avg(perScenario.map((s) => s.accuracyNorm))
    const meanSurvival = avg(perScenario.map((s) => s.survivalTerm))
    const meanActionGate = avg(perScenario.map((s) => s.actionGateVal))
    const meanTurnGate = avg(perScenario.map((s) => s.turnGateVal))
    const meanThrottleGate = avg(perScenario.map((s) => s.throttleGateVal))
    const meanTurnBias = avg(perScenario.map((s) => s.turnBiasVal))
    const meanEffectiveMax = avg(perScenario.map((s) => s.effectiveMaxRocks))
    const meanUniqueRocksSeen = avg(perScenario.map((s) => s.uniqueRocksSeen))
    const totalRocks = sum(perScenario.map((p) => p.rocksDestroyed))
    const totalDeaths = sum(perScenario.map((p) => p.deaths))
    const totalShots = sum(perScenario.map((p) => p.shotsFired))
    const totalHits = sum(perScenario.map((p) => p.shotsHit))

    const fg = perFullGame.length
    const meanFgFitness = fg > 0 ? avg(perFullGame.map((s) => s.fitness)) : 0
    const meanFgPerfScore =
      fg > 0 ? avg(perFullGame.map((s) => s.perfScore)) : 0
    const meanFgRocksNorm =
      fg > 0 ? avg(perFullGame.map((s) => s.rocksNorm)) : 0
    const meanFgAccuracyNorm =
      fg > 0 ? avg(perFullGame.map((s) => s.accuracyNorm)) : 0
    const meanFgSurvival =
      fg > 0 ? avg(perFullGame.map((s) => s.survivalTerm)) : 0
    const meanFgActionGate =
      fg > 0 ? avg(perFullGame.map((s) => s.actionGateVal)) : 0
    const meanFgTurnGate =
      fg > 0 ? avg(perFullGame.map((s) => s.turnGateVal)) : 0
    const meanFgThrottleGate =
      fg > 0 ? avg(perFullGame.map((s) => s.throttleGateVal)) : 0
    const meanFgTurnBias =
      fg > 0 ? avg(perFullGame.map((s) => s.turnBiasVal)) : 0
    const meanFgEffectiveMax =
      fg > 0 ? avg(perFullGame.map((s) => s.effectiveMaxRocks)) : 0
    const meanFgUniqueRocksSeen =
      fg > 0 ? avg(perFullGame.map((s) => s.uniqueRocksSeen)) : 0
    const totalFgRocks = sum(perFullGame.map((p) => p.rocksDestroyed))
    const totalFgDeaths = sum(perFullGame.map((p) => p.deaths))
    const totalFgShots = sum(perFullGame.map((p) => p.shotsFired))
    const totalFgHits = sum(perFullGame.map((p) => p.shotsHit))

    const aggMetrics = { ...aggFrames }
    const aggActionGate = actionDiversityGate(aggMetrics, gc)
    const aggTurnGateVal = turnGate(aggMetrics, gc)
    const aggThrottleGateVal = throttleGate(aggMetrics, gc)
    const aggTurnBiasGateVal = turnBiasGate(aggMetrics, gc)

    const blendedFitnessRaw =
      sw * meanScenarioFitness + fw * meanFgFitness + cw * curriculumFitness
    const blendedFitness = applyBehavioralGates(
      blendedFitnessRaw,
      aggMetrics,
      gc
    )

    // ── Print: Scenario Fitness ──
    console.log(`\n=== Scenario Fitness (${n} scenarios) ===`)
    console.log(`  scenarioFitness:  ${fmtNum(meanScenarioFitness)}`)

    console.log(`\n  ── Performance Components ──`)
    console.log(`  perfScore (weighted sum):   ${fmtNum(meanPerfScore)}`)
    console.log(
      `    rocksNorm:    ${fmtNum(meanRocksNorm)}  (w=${weights.rocksDestroyed} → ${fmtNum(weights.rocksDestroyed * meanRocksNorm)})`
    )
    console.log(
      `    accuracyNorm: ${fmtNum(meanAccuracyNorm)}  (w=${weights.accuracy} → ${fmtNum(weights.accuracy * meanAccuracyNorm)})  raw=${fmtNum(meanAccuracy)} target=${weights.targetAccuracy}`
    )

    console.log(`\n  ── Gates (multiplicative) ──`)
    console.log(`  actionGate:     ${fmtNum(meanActionGate)}`)
    console.log(`  turnGate:       ${fmtNum(meanTurnGate)}`)
    console.log(`  throttleGate:   ${fmtNum(meanThrottleGate)}`)
    console.log(`  turnBiasGate:   ${fmtNum(meanTurnBias)}`)
    console.log(`  survivalGate:   ${fmtNum(meanSurvival)}`)

    console.log(`\n  ── Rock Budget (fire-rate based) ──`)
    console.log(
      `  mean uniqueRocksSeen:        ${fmtNum(meanUniqueRocksSeen, 1)}`
    )
    console.log(`  mean possibleKills:          ${fmtNum(meanEffectiveMax, 1)}`)
    console.log(`  mean rocksDestroyed:         ${fmtNum(totalRocks / n, 1)}`)

    console.log(`\n  ── Totals ──`)
    console.log(
      `  rocksDestroyed: ${totalRocks}  deaths: ${totalDeaths}  shots: ${totalShots}  hits: ${totalHits}  accuracy: ${totalShots > 0 ? pct(totalHits / totalShots) : 'n/a'}`
    )

    // ── Print: Full Game Fitness ──
    console.log(
      `\n=== Full Game Fitness (${fg} seeds, maxTicks=${options.maxTicks}) ===`
    )
    console.log(
      `  maxPossibleDeaths: ${fgPossibleDeaths} (theoretical max; actual computed per-seed from elapsedTicks)`
    )
    console.log(`  fullGameFitness:  ${fmtNum(meanFgFitness)}`)

    console.log(`\n  ── Performance Components ──`)
    console.log(`  perfScore (weighted sum):   ${fmtNum(meanFgPerfScore)}`)
    console.log(
      `    rocksNorm:    ${fmtNum(meanFgRocksNorm)}  (w=${weights.rocksDestroyed} → ${fmtNum(weights.rocksDestroyed * meanFgRocksNorm)})`
    )
    console.log(
      `    accuracyNorm: ${fmtNum(meanFgAccuracyNorm)}  (w=${weights.accuracy} → ${fmtNum(weights.accuracy * meanFgAccuracyNorm)})`
    )

    console.log(`\n  ── Gates (multiplicative) ──`)
    console.log(`  actionGate:     ${fmtNum(meanFgActionGate)}`)
    console.log(`  turnGate:       ${fmtNum(meanFgTurnGate)}`)
    console.log(`  throttleGate:   ${fmtNum(meanFgThrottleGate)}`)
    console.log(`  turnBiasGate:   ${fmtNum(meanFgTurnBias)}`)
    console.log(`  survivalGate:   ${fmtNum(meanFgSurvival)}`)

    console.log(`\n  ── Rock Budget (fire-rate based) ──`)
    console.log(
      `  mean uniqueRocksSeen:        ${fmtNum(meanFgUniqueRocksSeen, 1)}`
    )
    console.log(
      `  mean possibleKills:          ${fmtNum(meanFgEffectiveMax, 1)}`
    )
    console.log(
      `  mean rocksDestroyed:         ${fg > 0 ? fmtNum(totalFgRocks / fg, 1) : '0.0'}`
    )
    console.log(
      `  mean deaths:                 ${fg > 0 ? fmtNum(totalFgDeaths / fg, 1) : '0.0'}`
    )

    console.log(`\n  ── Totals ──`)
    console.log(
      `  rocksDestroyed: ${totalFgRocks}  deaths: ${totalFgDeaths}  shots: ${totalFgShots}  hits: ${totalFgHits}  accuracy: ${totalFgShots > 0 ? pct(totalFgHits / totalFgShots) : 'n/a'}`
    )

    // ── Print: Curriculum Fitness ──
    if (options.curriculum) {
      console.log(`\n=== Curriculum Fitness ===`)
      console.log(
        `  ${curriculumKills}/${curriculumTotal} kills → avgFitness=${fmtNum(curriculumFitness)}`
      )
    }

    // ── Print: Blended Fitness ──
    console.log(`\n=== Blended Fitness ===`)
    console.log(
      `  rawBlended:   ${fmtNum(blendedFitnessRaw)}  (before aggregated gates)`
    )
    console.log(
      `  scenario × ${fmtNum(sw, 2)} + fullGame × ${fmtNum(fw, 2)} + curriculum × ${fmtNum(cw, 2)} = ${fmtNum(blendedFitnessRaw)}`
    )
    console.log(
      `    scenario:   ${fmtNum(meanScenarioFitness)} × ${fmtNum(sw, 2)} = ${fmtNum(sw * meanScenarioFitness)}`
    )
    console.log(
      `    fullGame:   ${fmtNum(meanFgFitness)} × ${fmtNum(fw, 2)} = ${fmtNum(fw * meanFgFitness)}`
    )
    if (options.curriculum) {
      console.log(
        `    curriculum: ${fmtNum(curriculumFitness)} × ${fmtNum(cw, 2)} = ${fmtNum(cw * curriculumFitness)}`
      )
    }

    // ── Print: Aggregated Behavioral Gates ──
    console.log(`\n=== Aggregated Behavioral Gates ===`)
    console.log(`  totalAliveFrames: ${aggFrames.aliveFrames}`)
    if (aggFrames.aliveFrames > 0) {
      console.log(
        `  thrust: ${pct(aggFrames.thrustFrames / aggFrames.aliveFrames)}  fire: ${pct(aggFrames.fireFrames / aggFrames.aliveFrames)}  left: ${pct(aggFrames.leftFrames / aggFrames.aliveFrames)}  right: ${pct(aggFrames.rightFrames / aggFrames.aliveFrames)}`
      )
    }
    console.log(`  actionGate:     ${fmtNum(aggActionGate)}`)
    console.log(`  turnGate:       ${fmtNum(aggTurnGateVal)}`)
    console.log(`  throttleGate:   ${fmtNum(aggThrottleGateVal)}`)
    console.log(`  turnBiasGate:   ${fmtNum(aggTurnBiasGateVal)}`)
    console.log(`  gatedFitness:   ${fmtNum(blendedFitness)}`)

    agentData.push({
      name,
      meanScenarioFitness,
      meanFgFitness,
      curriculumFitness,
      blendedFitnessRaw,
      blendedFitness,
      meanPerfScore,
      meanRocksNorm,
      meanAccuracy,
      meanAccuracyNorm,
      meanSurvival,
      meanActionGate,
      meanTurnGate,
      meanThrottleGate,
      meanTurnBias,
      aggActionGate,
      aggTurnGate: aggTurnGateVal,
      aggThrottleGate: aggThrottleGateVal,
      aggTurnBiasGate: aggTurnBiasGateVal,
      meanEffectiveMax,
      meanUniqueRocksSeen,
      meanFgSurvival,
      meanFgThrottleGate,
      meanFgPerfScore,
    })
    console.log()
  }

  // Comparison table
  if (agentData.length >= 2) {
    const colWidth = 12
    const labelWidth = 22
    const columns = agentData

    const rowDefs: [string, (d: AgentResult) => number][] = [
      ['scenarioFitness', (d) => d.meanScenarioFitness],
      ['fullGameFitness', (d) => d.meanFgFitness],
      ...(options.curriculum
        ? ([['curriculumFitness', (d: AgentResult) => d.curriculumFitness]] as [
            string,
            (d: AgentResult) => number,
          ][])
        : []),
      ['blendedRaw', (d) => d.blendedFitnessRaw],
      ['blendedFitness', (d) => d.blendedFitness],
      ['perfScore', (d) => d.meanPerfScore],
      ['rocksNorm', (d) => d.meanRocksNorm],
      ['accuracyNorm', (d) => d.meanAccuracyNorm],
      ['accuracyRaw', (d) => d.meanAccuracy],
      ['survivalGate(scn)', (d) => d.meanSurvival],
      ['survivalGate(fg)', (d) => d.meanFgSurvival],
      ['actionGate(avg)', (d) => d.meanActionGate],
      ['turnGate(avg)', (d) => d.meanTurnGate],
      ['throttleGate(avg)', (d) => d.meanThrottleGate],
      ['turnBiasGate(avg)', (d) => d.meanTurnBias],
      ['actionGate(agg)', (d) => d.aggActionGate],
      ['turnGate(agg)', (d) => d.aggTurnGate],
      ['throttleGate(agg)', (d) => d.aggThrottleGate],
      ['turnBiasGate(agg)', (d) => d.aggTurnBiasGate],
      ['possibleKills', (d) => d.meanEffectiveMax],
      ['uniqueRocksSeen', (d) => d.meanUniqueRocksSeen],
    ]

    const tableWidth = labelWidth + 2 + columns.length * colWidth
    console.log(`${'═'.repeat(tableWidth)}`)
    console.log(`  COMPARISON`)
    console.log(`${'═'.repeat(tableWidth)}`)
    console.log()

    const header =
      `  ${pad('Component', labelWidth)}` +
      columns.map((c) => pad(c.name, colWidth)).join('')
    console.log(header)
    console.log(`  ${'─'.repeat(tableWidth - 2)}`)

    for (const [label, getter] of rowDefs) {
      const values = columns.map((c) => getter(c))
      const line =
        `  ${pad(label, labelWidth)}` +
        values.map((v) => pad(fmtNum(v), colWidth)).join('')
      console.log(line)
    }

    console.log()
  }

  console.log(`${'═'.repeat(72)}`)
  console.log(`=== Done ===\n`)
}
