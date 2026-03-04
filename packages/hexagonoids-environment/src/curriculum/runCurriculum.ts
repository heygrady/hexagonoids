import { createRNG } from '@neat-evolution/utils'

import type { AgentFn, SyncExecutor } from '../agents/types.js'
import type { RawMetrics } from '../evaluation/RawMetrics.js'

import type {
  ConeIndex,
  CurriculumScenarioParams,
  ScenarioVariant,
} from './generateCurriculumScenario.js'
import { simulateCurriculumScenario } from './simulateCurriculumScenario.js'

const ALL_VARIANTS: ScenarioVariant[] = [
  'direct-towards',
  'direct-away',
  'lateral-left',
  'lateral-right',
]

const CONE_COUNT = 8
const FULL_SET_SIZE = CONE_COUNT * ALL_VARIANTS.length // 32

/**
 * Run curriculum micro-scenarios and collect full metrics for each.
 *
 * By default generates 8 cones x 4 variants = 32 scenarios.
 * If count < 32, samples a subset; if count > 32, repeats with different jitter.
 *
 * Each scenario gets a unique sub-seed derived from the organism's seed
 * to prevent memorization.
 *
 * Returns RawMetrics[] — one per scenario — so callers can score each
 * with weightedFitnessSum for rich gradient signal.
 */
export function runCurriculum(
  agent: AgentFn,
  seed: string,
  dtMs: number,
  count: number,
  executor?: SyncExecutor
): RawMetrics[] {
  const rng = createRNG(`${seed}:curriculum`)

  if (count <= 0) return []

  // Build scenario list
  const scenarios: CurriculumScenarioParams[] = []

  if (count <= FULL_SET_SIZE) {
    // Build full set, then sample if needed
    const fullSet: CurriculumScenarioParams[] = []
    for (let cone = 0; cone < CONE_COUNT; cone++) {
      for (const variant of ALL_VARIANTS) {
        fullSet.push({
          coneIndex: cone as ConeIndex,
          variant,
          rockSize: Math.floor(rng.gen() * 3) as 0 | 1 | 2,
          lateralOffset: (rng.gen() * 2 - 1) * 0.8,
        })
      }
    }

    if (count >= FULL_SET_SIZE) {
      scenarios.push(...fullSet)
    } else {
      // Fisher-Yates partial shuffle to select `count` items
      for (let i = fullSet.length - 1; i > 0; i--) {
        const j = Math.floor(rng.gen() * (i + 1))
        const tmp = fullSet[i]!
        fullSet[i] = fullSet[j]!
        fullSet[j] = tmp
      }
      scenarios.push(...fullSet.slice(0, count))
    }
  } else {
    // count > 32: run full set plus extras with different jitter
    for (let i = 0; i < count; i++) {
      const cone = (i % CONE_COUNT) as ConeIndex
      const variant =
        ALL_VARIANTS[Math.floor(i / CONE_COUNT) % ALL_VARIANTS.length]!
      scenarios.push({
        coneIndex: cone,
        variant,
        rockSize: Math.floor(rng.gen() * 3) as 0 | 1 | 2,
        lateralOffset: (rng.gen() * 2 - 1) * 0.8,
      })
    }
  }

  // Run each scenario and collect metrics
  const results: RawMetrics[] = []
  for (let i = 0; i < scenarios.length; i++) {
    const scenarioSeed = `${seed}:curriculum:${i}`
    const metrics = simulateCurriculumScenario(
      agent,
      scenarios[i]!,
      scenarioSeed,
      dtMs,
      executor
    )
    results.push(metrics)
  }

  return results
}
