import { createRNG } from '@neat-evolution/utils'

import { captureSnapshot } from '../scenarios/captureSnapshot.js'
import type { ScenarioSnapshot } from '../scenarios/types.js'
import {
  ALL_DISTANCE_CLASSES,
  ALL_PATTERNS,
  type CurriculumScenarioParams,
  createCurriculumGameState,
  type DistanceClass,
  isValidPatternDistance,
  MAX_HEADING_JITTER,
} from './generateCurriculumScenario.js'

/** Number of stratified angle bins. */
const ANGLE_BINS = 12

/** Total number of curriculum scenarios (12 angle bins × 5 patterns). */
export const CURRICULUM_SCENARIO_COUNT = ANGLE_BINS * ALL_PATTERNS.length // 60

/**
 * Rock count weights: 1=40%, 2=25%, 3=20%, 4=10%, 5=5%.
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
 * tight ±15° (60%), split ±90° (30%), surrounding ±180° (10%).
 */
const SPREAD_THRESHOLDS: [threshold: number, spread: number][] = [
  [0.6, 0.26],
  [0.9, 1.57],
  [1.0, Math.PI],
]

/**
 * Distance class weights: close=15%, mid=40%, far=35%, beyond=10%.
 */
const DISTANCE_THRESHOLDS: [threshold: number, distance: DistanceClass][] = [
  [0.15, 'close'],
  [0.55, 'mid'],
  [0.9, 'far'],
  [1.0, 'beyond'],
]

/** Pick a value from cumulative threshold table. */
function weightedPick<T>(
  thresholds: [threshold: number, value: T][],
  roll: number
): T {
  for (const [threshold, value] of thresholds) {
    if (roll < threshold) return value
  }
  const last = thresholds[thresholds.length - 1]
  if (last == null) {
    throw new Error('Empty threshold table')
  }
  return last[1]
}

/** Pick a valid distance class for the given pattern. */
function pickValidDistance(
  pattern: string,
  rng: ReturnType<typeof createRNG>
): DistanceClass {
  const initial = weightedPick(DISTANCE_THRESHOLDS, rng.gen())
  if (
    isValidPatternDistance(
      pattern as Parameters<typeof isValidPatternDistance>[0],
      initial
    )
  ) {
    return initial
  }
  const valid = ALL_DISTANCE_CLASSES.filter((d) =>
    isValidPatternDistance(
      pattern as Parameters<typeof isValidPatternDistance>[0],
      d
    )
  )
  return valid[rng.genIntRange(0, valid.length)] as DistanceClass
}

/**
 * Deterministic params for a given index, wrapping modulo 60.
 * Cycles angle-inner (all 12 angles for pattern 0, then all 12 for pattern 1, etc.)
 * for visual variety in observe mode.
 *
 * Includes multi-rock, spread, and distance parameters matching the
 * same distributions used during training.
 */
export function buildCurriculumParams(
  index: number,
  seed: string
): CurriculumScenarioParams {
  const wrapped =
    ((index % CURRICULUM_SCENARIO_COUNT) + CURRICULUM_SCENARIO_COUNT) %
    CURRICULUM_SCENARIO_COUNT
  const angleBin = wrapped % ANGLE_BINS
  const patternIndex = Math.floor(wrapped / ANGLE_BINS)
  const pattern = ALL_PATTERNS[patternIndex]
  if (pattern == null) {
    throw new Error(`Invalid pattern index: ${patternIndex}`)
  }
  const rng = createRNG(seed).derive(`curriculum-params:${index}`)
  const TWO_PI = 2 * Math.PI
  const binWidth = TWO_PI / ANGLE_BINS
  const angle = (angleBin + rng.gen()) * binWidth
  const rockSize = rng.genIntRange(0, 3) as 0 | 1 | 2
  const headingJitter = (rng.gen() * 2 - 1) * MAX_HEADING_JITTER
  const rockCount = weightedPick(ROCK_COUNT_THRESHOLDS, rng.gen())
  const secondarySpread =
    rockCount > 1 ? weightedPick(SPREAD_THRESHOLDS, rng.gen()) : 0
  const distance = pickValidDistance(pattern, rng)
  return {
    angle,
    pattern,
    rockSize,
    headingJitter,
    rockCount,
    secondarySpread,
    distance,
  }
}

export interface CurriculumSnapshotResult {
  snapshot: ScenarioSnapshot
  /** Tick budget for this scenario (based on 3x rock travel time). */
  maxTicks: number
}

/**
 * Create a curriculum game state and capture it as a ScenarioSnapshot.
 * Returns both the snapshot and the tick budget so callers can enforce a time limit.
 */
export function generateCurriculumSnapshot(
  params: CurriculumScenarioParams,
  seed: string,
  dtMs: number
): CurriculumSnapshotResult {
  const { engine, maxTicks } = createCurriculumGameState(params, seed, dtMs)
  const snapshot = captureSnapshot(engine.state, 'player-1', {
    id: `curriculum-a${Math.floor((params.angle / (2 * Math.PI)) * ANGLE_BINS)}-${params.pattern}`,
  })
  return { snapshot, maxTicks }
}
