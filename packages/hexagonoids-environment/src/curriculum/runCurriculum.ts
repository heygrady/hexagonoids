import { createRNG } from '@neat-evolution/utils'

import type { AgentFn } from '../agents/types.js'
import type { RawMetrics } from '../evaluation/RawMetrics.js'
import type { SimulationHooks } from '../evaluation/simulateGame.js'

/** Result of a single curriculum scenario: metrics paired with the params that generated them. */
export interface CurriculumResult {
  metrics: RawMetrics
  params: CurriculumScenarioParams
}

import {
  ALL_DISTANCE_CLASSES,
  ALL_PATTERNS,
  type CurriculumScenarioParams,
  type DistanceClass,
  isValidPatternDistance,
  MAX_HEADING_JITTER,
} from './generateCurriculumScenario.js'
import { simulateCurriculumScenario } from './simulateCurriculumScenario.js'

/** Number of stratified angle bins around the ship. */
const ANGLE_BINS = 12

/** Full stratified set: 12 angles × 5 patterns = 60. */
const FULL_SET_SIZE = ANGLE_BINS * ALL_PATTERNS.length // 60

/**
 * Run curriculum micro-scenarios and collect full metrics for each.
 *
 * Generates scenarios from 12 stratified angle bins × 5 approach patterns.
 * Within each bin, the angle is randomized for continuous coverage.
 *
 * If count <= 60, samples a subset via Fisher-Yates.
 * If count > 60, repeats with fresh randomization per extra round.
 *
 * Each scenario gets a unique sub-seed derived from the organism's seed
 * to prevent memorization.
 *
 * Returns CurriculumResult[] — one per scenario — with both metrics and
 * the params that generated them, so callers can score each and inspect
 * per-pattern/per-distance breakdowns.
 */
export function runCurriculum(
  agent: AgentFn,
  seed: string,
  dtMs: number,
  count: number,
  hooksFactory?: (index: number) => SimulationHooks | undefined
): CurriculumResult[] {
  const rng = createRNG(seed).derive('curriculum')

  if (count <= 0) return []

  // Build scenario list
  const scenarios: CurriculumScenarioParams[] = []

  if (count <= FULL_SET_SIZE) {
    // Build full set, then sample if needed
    const fullSet = buildFullSet(rng)

    if (count >= FULL_SET_SIZE) {
      scenarios.push(...fullSet)
    } else {
      // Fisher-Yates partial shuffle to select `count` items
      shuffleInPlace(fullSet, rng)
      scenarios.push(...fullSet.slice(0, count))
    }
  } else {
    // count > 60: run full rounds plus extras with fresh randomization
    const fullRounds = Math.floor(count / FULL_SET_SIZE)
    const remainder = count % FULL_SET_SIZE

    for (let round = 0; round < fullRounds; round++) {
      scenarios.push(...buildFullSet(rng))
    }

    if (remainder > 0) {
      const extra = buildFullSet(rng)
      shuffleInPlace(extra, rng)
      scenarios.push(...extra.slice(0, remainder))
    }
  }

  // Run each scenario and collect metrics
  const results: CurriculumResult[] = []
  for (let i = 0; i < scenarios.length; i++) {
    const scenarioSeed = rng.derive(`scenario:${i}`).toSeed()
    const hooks = hooksFactory?.(i)
    const params = scenarios[i]
    if (params == null) {
      throw new Error(`Missing scenario params at index ${i}`)
    }
    const metrics = simulateCurriculumScenario(
      agent,
      params,
      scenarioSeed,
      dtMs,
      hooks
    )
    results.push({ metrics, params })
  }

  return results
}

/** Fisher-Yates in-place shuffle. */
function shuffleInPlace<T>(arr: T[], rng: ReturnType<typeof createRNG>): void {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = rng.genIntRange(0, i + 1)
    const tmp = arr[i]
    arr[i] = arr[j] as T
    arr[j] = tmp as T
  }
}

/**
 * Rock count weights: 1=40%, 2=25%, 3=20%, 4=10%, 5=5%.
 * Cumulative thresholds for weighted random selection.
 */
const ROCK_COUNT_THRESHOLDS: [threshold: number, count: number][] = [
  [0.4, 1],
  [0.65, 2],
  [0.85, 3],
  [0.95, 4],
  [1.0, 5],
]

/**
 * Secondary spread strategies (radians):
 * - tight cluster: ±15° (0.26 rad) — 60%
 * - split field: ±90° (1.57 rad) — 30%
 * - surrounding: ±180° (3.14 rad) — 10%
 */
const SPREAD_THRESHOLDS: [threshold: number, spread: number][] = [
  [0.6, 0.26],
  [0.9, 1.57],
  [1.0, Math.PI],
]

/** Pick a value from cumulative threshold table. */
function weightedPick<T>(
  thresholds: [threshold: number, value: T][],
  roll: number
): T {
  for (const [threshold, value] of thresholds) {
    if (roll < threshold) return value
  }
  // Fallback to last entry (should not happen with well-formed thresholds)
  const last = thresholds[thresholds.length - 1]
  if (last == null) {
    throw new Error('Empty threshold table')
  }
  return last[1]
}

/**
 * Distance class weights: close=15%, mid=40%, far=35%, beyond=10%.
 * Cumulative thresholds for weighted random selection.
 */
const DISTANCE_THRESHOLDS: [threshold: number, distance: DistanceClass][] = [
  [0.15, 'close'],
  [0.55, 'mid'],
  [0.9, 'far'],
  [1.0, 'beyond'],
]

/**
 * Pick a valid distance class for the given pattern.
 * Re-rolls if the initial pick is invalid for this pattern.
 */
function pickValidDistance(
  pattern: string,
  rng: ReturnType<typeof createRNG>
): DistanceClass {
  // Try weighted pick first
  const initial = weightedPick(DISTANCE_THRESHOLDS, rng.gen())
  if (
    isValidPatternDistance(
      pattern as Parameters<typeof isValidPatternDistance>[0],
      initial
    )
  ) {
    return initial
  }
  // Re-roll from valid options for this pattern
  const valid = ALL_DISTANCE_CLASSES.filter((d) =>
    isValidPatternDistance(
      pattern as Parameters<typeof isValidPatternDistance>[0],
      d
    )
  )
  return valid[rng.genIntRange(0, valid.length)] as DistanceClass
}

/**
 * Build one full set of 60 scenarios (12 angle bins × 5 patterns).
 * Each angle is randomized within its bin for continuous coverage.
 * Rock count, secondary spread, and distance class are randomized per scenario.
 */
function buildFullSet(
  rng: ReturnType<typeof createRNG>
): CurriculumScenarioParams[] {
  const TWO_PI = 2 * Math.PI
  const binWidth = TWO_PI / ANGLE_BINS

  const set: CurriculumScenarioParams[] = []
  for (let bin = 0; bin < ANGLE_BINS; bin++) {
    for (const pattern of ALL_PATTERNS) {
      // Continuous angle within this bin
      const angle = (bin + rng.gen()) * binWidth
      const headingJitter = (rng.gen() * 2 - 1) * MAX_HEADING_JITTER
      const rockSize = rng.genIntRange(0, 3) as 0 | 1 | 2
      const rockCount = weightedPick(ROCK_COUNT_THRESHOLDS, rng.gen())
      const secondarySpread =
        rockCount > 1 ? weightedPick(SPREAD_THRESHOLDS, rng.gen()) : 0
      const distance = pickValidDistance(pattern, rng)
      set.push({
        angle,
        pattern,
        rockSize,
        headingJitter,
        rockCount,
        secondarySpread,
        distance,
      })
    }
  }
  return set
}
