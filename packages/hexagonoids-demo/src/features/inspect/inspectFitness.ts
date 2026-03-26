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
  ALL_PATTERNS,
  computePossibleDeaths,
  DEFAULT_HEXAGONOIDS_ENVIRONMENT_CONFIG,
  doNothingAgent,
  type GameAgent,
  type GauntletBreakdown,
  HexagonoidsEnvironment,
  METRIC_EPISODE_FITNESS,
  METRIC_GAUNTLET_BREAKDOWN,
  mergeConfig,
  randomAgent,
} from '@heygrady/hexagonoids-environment'
import type { PartialEvaluationContext } from '@neat-evolution/execution-manager'
import { createMemoryRecorder } from '@neat-evolution/stats'
import { createRNG } from '@neat-evolution/utils'
import { loadScenarioBank } from '../../data/scenarios.js'
import { defaultProfile } from '../profiles/index.js'
import type { SupportedAlgorithm } from '../registries/algorithmRegistry.js'
import { hydrateToExecutor } from '../registries/hydrateGenome.js'

// ── Package root for artifact discovery ──
const PACKAGE_ROOT = resolve(new URL('.', import.meta.url).pathname, '../../..')

export interface InspectFitnessOptions {
  scenariosPerOrganism: number
  scenarioMaxTicks: number
  seed: string
  dtMs: number
  curriculumCount: number
  scenarioWeight: number
  fullGameWeight: number
  curriculumWeight: number
  maxTicks: number
  fullGameSeeds: number
  genome: string | undefined
  lab: string | undefined
  method: string
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

// ── Agent entry types ──

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

function pct(value: number): string {
  return `${(value * 100).toFixed(1)}%`
}
function pad(str: string | number, len: number): string {
  return String(str).padEnd(len)
}
function fmtNum(n: number, decimals = 4): string {
  return n.toFixed(decimals)
}

// ── Evaluate one agent ──

function evaluateWithRecorder(
  environment: HexagonoidsEnvironment,
  entry: AgentEntry,
  seed: string
): { fitness: number; breakdown: GauntletBreakdown } {
  const recorder = createMemoryRecorder([
    METRIC_GAUNTLET_BREAKDOWN,
    METRIC_EPISODE_FITNESS,
  ])
  const rng = createRNG(seed)
  const context: PartialEvaluationContext = { rng, stats: recorder }

  let fitness: number
  if (entry.type === 'executor') {
    const executor = hydrateToExecutor(entry.genomePath, entry.method)
    fitness = environment.evaluate(executor, context)
  } else {
    const gameAgent: GameAgent = {
      agent: entry.agentFn,
      observe: () => new Float64Array(0),
      resetMemory: () => {},
    }
    fitness = environment.evaluateGameAgent(gameAgent, context)
  }

  const breakdowns = recorder.get<GauntletBreakdown>(METRIC_GAUNTLET_BREAKDOWN)
  if (breakdowns.length === 0) {
    throw new Error(`No gauntlet breakdown recorded for agent "${entry.name}"`)
  }
  return { fitness, breakdown: breakdowns[0] as GauntletBreakdown }
}

// ── Main ──

export async function runInspectFitness(
  options: InspectFitnessOptions
): Promise<void> {
  const pc = (defaultProfile.config ?? {}) as Record<string, unknown>

  const envConfig = mergeConfig({
    simulation: {
      scenariosPerOrganism: options.scenariosPerOrganism,
      scenarioMaxTicks: options.scenarioMaxTicks,
      maxTicks: options.maxTicks,
      dtMs: options.dtMs,
      curriculumCount: options.curriculumCount,
    },
    fitnessWeights: pc.fitnessWeights as Record<string, number> | undefined,
    ...(pc.behavioralGateConfig != null && {
      behavioralGateConfig: pc.behavioralGateConfig,
    }),
    scenarioWeight: options.scenarioWeight,
    fullGameWeight: options.fullGameWeight,
    curriculumWeight: options.curriculumWeight,
    fullGameSeedsPerOrganism: options.fullGameSeeds,
  } as unknown as Parameters<typeof mergeConfig>[0])

  const scenarioBank = await loadScenarioBank()

  const { scenariosPerOrganism, scenarioMaxTicks } = envConfig.simulation
  const weights = envConfig.fitnessWeights
  const fgPossibleDeaths = computePossibleDeaths(options.maxTicks, options.dtMs)

  // Normalize blending weights for display
  let sw = options.scenarioWeight
  let fw = options.fullGameWeight
  let cw = options.curriculumWeight > 0 ? options.curriculumWeight : 0
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
  if (options.curriculumWeight > 0) {
    console.log(`Curriculum: enabled, count=${options.curriculumCount}`)
  }
  console.log(
    `Blending: scenario=${fmtNum(sw, 2)} fullGame=${fmtNum(fw, 2)} curriculum=${fmtNum(cw, 2)}`
  )
  console.log(
    `Full game: maxTicks=${options.maxTicks} seeds=${options.fullGameSeeds} maxPossibleDeaths=${fgPossibleDeaths} (per-seed from elapsedTicks)`
  )
  console.log()

  // Create environment
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
        const hasBest = labGenomes.some((g) => g.label === 'best')
        const sampledCount = labGenomes.filter((g) => g.label !== 'best').length
        const parts: string[] = []
        if (hasBest) parts.push('best')
        if (sampledCount > 0) parts.push(`${sampledCount} sampled generations`)
        console.log(`Lab: ${labDir}`)
        console.log(`Found ${labGenomes.length} genomes (${parts.join(' + ')})`)
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

  // Load explicit genome
  if (options.genome) {
    const genomePath = resolve(options.genome)
    console.log(`Loading genome: ${genomePath}`)
    console.log(`Method: ${options.method}`)
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

  interface AgentResult {
    name: string
    breakdown: GauntletBreakdown
  }

  const agentData: AgentResult[] = []

  for (const entry of agents) {
    console.log(`${'─'.repeat(60)}`)
    console.log(`Agent: ${entry.name}`)
    console.log(`${'─'.repeat(60)}`)

    const { breakdown } = evaluateWithRecorder(environment, entry, options.seed)

    const avg = (arr: number[]) =>
      arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 0

    // ── Print: Scenario Fitness ──
    const sBreakdowns = breakdown.scenarioBreakdowns
    const sN = sBreakdowns.length
    console.log(`\n=== Scenario Fitness (${sN} scenarios) ===`)
    console.log(`  scenarioFitness:  ${fmtNum(breakdown.scenarioFitness)}`)

    if (sN > 0) {
      const meanPerfScore = avg(sBreakdowns.map((b) => b.perfScore))
      const meanRocksNorm = avg(sBreakdowns.map((b) => b.rocksNorm))
      const meanAccuracyNorm = avg(sBreakdowns.map((b) => b.accuracyNorm))
      const meanAccuracy = avg(sBreakdowns.map((b) => b.accuracy))
      const meanSurvival = avg(sBreakdowns.map((b) => b.survivalGate))
      const meanEffectiveMax = avg(sBreakdowns.map((b) => b.effectiveMaxRocks))
      const meanUniqueRocksSeen = avg(sBreakdowns.map((b) => b.uniqueRocksSeen))
      const totalRocks = sBreakdowns.reduce((a, b) => a + b.rocksDestroyed, 0)
      const totalDeaths = sBreakdowns.reduce((a, b) => a + b.deaths, 0)

      console.log(`\n  ── Performance Components ──`)
      console.log(`  perfScore (weighted sum):   ${fmtNum(meanPerfScore)}`)
      console.log(
        `    rocksNorm:    ${fmtNum(meanRocksNorm)}  (w=${weights.rocksDestroyed} → ${fmtNum(weights.rocksDestroyed * meanRocksNorm)})`
      )
      console.log(
        `    accuracyNorm: ${fmtNum(meanAccuracyNorm)}  (w=${weights.accuracy} → ${fmtNum(weights.accuracy * meanAccuracyNorm)})  raw=${fmtNum(meanAccuracy)} target=${weights.targetAccuracy}`
      )

      console.log(`\n  ── Gates (multiplicative) ──`)
      console.log(`  survivalGate:   ${fmtNum(meanSurvival)}`)

      console.log(`\n  ── Rock Budget (fire-rate based) ──`)
      console.log(
        `  mean uniqueRocksSeen:        ${fmtNum(meanUniqueRocksSeen, 1)}`
      )
      console.log(
        `  mean possibleKills:          ${fmtNum(meanEffectiveMax, 1)}`
      )
      console.log(
        `  mean rocksDestroyed:         ${fmtNum(totalRocks / sN, 1)}`
      )

      console.log(`\n  ── Totals ──`)
      console.log(`  rocksDestroyed: ${totalRocks}  deaths: ${totalDeaths}`)
    }

    // ── Print: Full Game Fitness ──
    const fgBreakdowns = breakdown.fullGameBreakdowns
    const fgN = fgBreakdowns.length
    console.log(
      `\n=== Full Game Fitness (${fgN} seeds, maxTicks=${options.maxTicks}) ===`
    )
    console.log(
      `  maxPossibleDeaths: ${fgPossibleDeaths} (theoretical max; actual computed per-seed from elapsedTicks)`
    )
    console.log(`  fullGameFitness:  ${fmtNum(breakdown.fullGameFitness)}`)

    if (fgN > 0) {
      const meanFgPerfScore = avg(fgBreakdowns.map((b) => b.perfScore))
      const meanFgRocksNorm = avg(fgBreakdowns.map((b) => b.rocksNorm))
      const meanFgAccuracyNorm = avg(fgBreakdowns.map((b) => b.accuracyNorm))
      const meanFgSurvival = avg(fgBreakdowns.map((b) => b.survivalGate))
      const meanFgEffectiveMax = avg(
        fgBreakdowns.map((b) => b.effectiveMaxRocks)
      )
      const meanFgUniqueRocksSeen = avg(
        fgBreakdowns.map((b) => b.uniqueRocksSeen)
      )
      const totalFgRocks = fgBreakdowns.reduce(
        (a, b) => a + b.rocksDestroyed,
        0
      )
      const totalFgDeaths = fgBreakdowns.reduce((a, b) => a + b.deaths, 0)

      console.log(`\n  ── Performance Components ──`)
      console.log(`  perfScore (weighted sum):   ${fmtNum(meanFgPerfScore)}`)
      console.log(
        `    rocksNorm:    ${fmtNum(meanFgRocksNorm)}  (w=${weights.rocksDestroyed} → ${fmtNum(weights.rocksDestroyed * meanFgRocksNorm)})`
      )
      console.log(
        `    accuracyNorm: ${fmtNum(meanFgAccuracyNorm)}  (w=${weights.accuracy} → ${fmtNum(weights.accuracy * meanFgAccuracyNorm)})`
      )

      console.log(`\n  ── Gates (multiplicative) ──`)
      console.log(`  survivalGate:   ${fmtNum(meanFgSurvival)}`)

      console.log(`\n  ── Rock Budget (fire-rate based) ──`)
      console.log(
        `  mean uniqueRocksSeen:        ${fmtNum(meanFgUniqueRocksSeen, 1)}`
      )
      console.log(
        `  mean possibleKills:          ${fmtNum(meanFgEffectiveMax, 1)}`
      )
      console.log(
        `  mean rocksDestroyed:         ${fmtNum(totalFgRocks / fgN, 1)}`
      )
      console.log(
        `  mean deaths:                 ${fmtNum(totalFgDeaths / fgN, 1)}`
      )

      console.log(`\n  ── Totals ──`)
      console.log(`  rocksDestroyed: ${totalFgRocks}  deaths: ${totalFgDeaths}`)
    }

    // ── Print: Curriculum Fitness ──
    if (options.curriculumWeight > 0) {
      const cBreakdowns = breakdown.curriculumBreakdowns
      const cParams = breakdown.curriculumParams ?? []
      const cN = cBreakdowns.length
      console.log(`\n=== Curriculum Fitness (${cN} scenarios) ===`)
      console.log(
        `  curriculumFitness:  ${fmtNum(breakdown.curriculumFitness)}`
      )

      if (cN > 0 && cParams.length === cN) {
        // ── By pattern ──
        console.log(`\n  ── By pattern ──`)
        for (const pattern of ALL_PATTERNS) {
          const indices: number[] = []
          for (let i = 0; i < cN; i++) {
            if (cParams[i]?.pattern === pattern) indices.push(i)
          }
          if (indices.length === 0) continue
          const patternFitness =
            indices.reduce(
              (sum, i) => sum + (cBreakdowns[i]?.fitness ?? 0),
              0
            ) / indices.length
          const patternKills = indices.reduce(
            (sum, i) => sum + (cBreakdowns[i]?.rocksDestroyed ?? 0),
            0
          )
          console.log(
            `  ${pad(pattern + ':', 12)} ${fmtNum(patternFitness)}  (${indices.length} scenarios, ${patternKills} kills)`
          )
        }

        // ── By rock count ──
        console.log(`\n  ── By rock count ──`)
        const countBuckets = new Map<string, number[]>()
        for (let i = 0; i < cN; i++) {
          const rc = cParams[i]?.rockCount ?? 1
          const label = rc >= 3 ? '3+' : String(rc)
          const existing = countBuckets.get(label)
          if (existing != null) {
            existing.push(i)
          } else {
            countBuckets.set(label, [i])
          }
        }
        for (const [label, indices] of [...countBuckets.entries()].sort(
          (a, b) => a[0].localeCompare(b[0])
        )) {
          const bucketFitness =
            indices.reduce(
              (sum, i) => sum + (cBreakdowns[i]?.fitness ?? 0),
              0
            ) / indices.length
          const noun = label === '1' ? 'rock' : 'rocks'
          console.log(
            `  ${pad(label + ' ' + noun + ':', 12)} ${fmtNum(bucketFitness)}  (${indices.length} scenarios)`
          )
        }

        // ── By distance ──
        console.log(`\n  ── By distance ──`)
        const distBuckets = new Map<string, number[]>()
        for (let i = 0; i < cN; i++) {
          const dist = cParams[i]?.distance ?? 'far'
          const existing = distBuckets.get(dist)
          if (existing != null) {
            existing.push(i)
          } else {
            distBuckets.set(dist, [i])
          }
        }
        for (const [label, indices] of distBuckets) {
          const bucketFitness =
            indices.reduce(
              (sum, i) => sum + (cBreakdowns[i]?.fitness ?? 0),
              0
            ) / indices.length
          console.log(
            `  ${pad(label + ':', 12)} ${fmtNum(bucketFitness)}  (${indices.length} scenarios)`
          )
        }
      }
    }

    // ── Print: Blended Fitness ──
    console.log(`\n=== Blended Fitness ===`)
    console.log(
      `  rawBlended:   ${fmtNum(breakdown.blendedFitnessRaw)}  (before aggregated gates)`
    )
    console.log(
      `  scenario × ${fmtNum(sw, 2)} + fullGame × ${fmtNum(fw, 2)} + curriculum × ${fmtNum(cw, 2)} = ${fmtNum(breakdown.blendedFitnessRaw)}`
    )
    console.log(
      `    scenario:   ${fmtNum(breakdown.scenarioFitness)} × ${fmtNum(sw, 2)} = ${fmtNum(sw * breakdown.scenarioFitness)}`
    )
    console.log(
      `    fullGame:   ${fmtNum(breakdown.fullGameFitness)} × ${fmtNum(fw, 2)} = ${fmtNum(fw * breakdown.fullGameFitness)}`
    )
    if (options.curriculumWeight > 0) {
      console.log(
        `    curriculum: ${fmtNum(breakdown.curriculumFitness)} × ${fmtNum(cw, 2)} = ${fmtNum(cw * breakdown.curriculumFitness)}`
      )
    }

    // ── Print: Aggregated Behavioral Gates ──
    const { gates, aggregatedFrames } = breakdown
    console.log(`\n=== Aggregated Behavioral Gates ===`)
    console.log(`  totalAliveFrames: ${aggregatedFrames.aliveFrames}`)
    if (aggregatedFrames.aliveFrames > 0) {
      console.log(
        `  thrust: ${pct(aggregatedFrames.thrustFrames / aggregatedFrames.aliveFrames)}  fire: ${pct(aggregatedFrames.fireFrames / aggregatedFrames.aliveFrames)}  left: ${pct(aggregatedFrames.leftFrames / aggregatedFrames.aliveFrames)}  right: ${pct(aggregatedFrames.rightFrames / aggregatedFrames.aliveFrames)}`
      )
    }
    console.log(`  thrustGate:     ${fmtNum(gates.thrust)}`)
    console.log(`  fireGate:       ${fmtNum(gates.fire)}`)
    console.log(`  turnGate:       ${fmtNum(gates.turn)}`)
    console.log(`  turnBiasGate:   ${fmtNum(gates.turnBias)}`)
    console.log(`  combinedGate:   ${fmtNum(gates.combined)}`)
    console.log(`  gatedFitness:   ${fmtNum(breakdown.fitness)}`)

    agentData.push({ name: entry.name, breakdown })
    console.log()
  }

  // Comparison table
  if (agentData.length >= 2) {
    const colWidth = 12
    const labelWidth = 22
    const columns = agentData

    const rowDefs: [string, (d: AgentResult) => number][] = [
      ['scenarioFitness', (d) => d.breakdown.scenarioFitness],
      ['fullGameFitness', (d) => d.breakdown.fullGameFitness],
      ...(options.curriculumWeight > 0
        ? ([
            [
              'curriculumFitness',
              (d: AgentResult) => d.breakdown.curriculumFitness,
            ],
          ] as [string, (d: AgentResult) => number][])
        : []),
      ['blendedRaw', (d) => d.breakdown.blendedFitnessRaw],
      ['blendedFitness', (d) => d.breakdown.fitness],
      ['thrustGate(agg)', (d) => d.breakdown.gates.thrust],
      ['fireGate(agg)', (d) => d.breakdown.gates.fire],
      ['turnGate(agg)', (d) => d.breakdown.gates.turn],
      ['turnBiasGate(agg)', (d) => d.breakdown.gates.turnBias],
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
