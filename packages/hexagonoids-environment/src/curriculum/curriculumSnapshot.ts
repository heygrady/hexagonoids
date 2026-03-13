import { createRNG } from '@neat-evolution/utils'

import { captureSnapshot } from '../scenarios/captureSnapshot.js'
import type { ScenarioSnapshot } from '../scenarios/types.js'

import type {
  ConeIndex,
  CurriculumScenarioParams,
  ScenarioVariant,
} from './generateCurriculumScenario.js'
import { createCurriculumGameState } from './generateCurriculumScenario.js'

const CONE_COUNT = 8
const ALL_VARIANTS: ScenarioVariant[] = [
  'direct-towards',
  'direct-away',
  'lateral-left',
  'lateral-right',
]

/** Total number of curriculum scenarios (8 cones x 4 variants). */
export const CURRICULUM_SCENARIO_COUNT = CONE_COUNT * ALL_VARIANTS.length // 32

/**
 * Deterministic params for a given index, wrapping modulo 32.
 * Cycles cone-inner (all 8 cones for variant 0, then all 8 for variant 1, etc.)
 * for visual variety.
 */
export function buildCurriculumParams(
  index: number,
  seed: string
): CurriculumScenarioParams {
  const wrapped =
    ((index % CURRICULUM_SCENARIO_COUNT) + CURRICULUM_SCENARIO_COUNT) %
    CURRICULUM_SCENARIO_COUNT
  const coneIndex = (wrapped % CONE_COUNT) as ConeIndex
  const variantIndex = Math.floor(wrapped / CONE_COUNT)
  const variant = ALL_VARIANTS[variantIndex] as ScenarioVariant
  const rng = createRNG(`${seed}:curriculum-params:${index}`)
  const rockSize = Math.floor(rng.gen() * 3) as 0 | 1 | 2
  const lateralOffset = (rng.gen() * 2 - 1) * 0.8
  return { coneIndex, variant, rockSize, lateralOffset }
}

export interface CurriculumSnapshotResult {
  snapshot: ScenarioSnapshot
  /** Tick budget for this scenario (based on 1.5x rock travel time). */
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
    id: `curriculum-c${params.coneIndex}-${params.variant}`,
  })
  return { snapshot, maxTicks }
}
