import type { GameState } from '@heygrady/hexagonoids-engine'
import type { RockPerceptionPrecompute } from './collectObservations.js'
import { collectObservations, LIDAR_RAY_COUNT } from './collectObservations.js'
import type { ObservationFrame } from './observationTypes.js'

const GLOBAL_FEATURES = 5
const FEATURES_PER_RAY = 4

/** Total number of input floats produced by the encoding */
export const INPUT_COUNT = GLOBAL_FEATURES + LIDAR_RAY_COUNT * FEATURES_PER_RAY

/**
 * Encode game state into a fixed-size vector.
 *
 * Layout (69):
 * [0] speed_norm
 * [1] heading_forward_drift
 * [2] heading_lateral_drift
 * [3] angular_velocity_norm
 * [4] cooldown_norm
 * [5..] 16 rays x 4:
 *   proximity(1-distance_norm), closing_speed_norm, is_rock, is_bullet
 */
export function encodeGameState(
  state: GameState,
  playerId: string,
  prevDistances: Map<string, number>,
  dtMs: number,
  inputsBuffer?: number[],
  observationsBuffer?: ObservationFrame,
  rockPerceptionBuffer?: RockPerceptionPrecompute
): number[] {
  const obs = collectObservations(
    state,
    playerId,
    prevDistances,
    dtMs,
    observationsBuffer,
    rockPerceptionBuffer
  )
  const inputs =
    inputsBuffer != null && inputsBuffer.length === INPUT_COUNT
      ? inputsBuffer
      : new Array<number>(INPUT_COUNT)

  inputs[0] = obs.ship.speedNorm
  inputs[1] = obs.ship.headingForwardDrift
  inputs[2] = obs.ship.headingLateralDrift
  inputs[3] = obs.ship.angularVelocityNorm
  inputs[4] = obs.temporal.cooldownNorm

  for (let i = 0; i < LIDAR_RAY_COUNT; i++) {
    const hit = obs.lidar[i]!
    const base = GLOBAL_FEATURES + i * FEATURES_PER_RAY
    inputs[base] = 1 - hit.distanceNorm
    inputs[base + 1] = hit.closingSpeed
    inputs[base + 2] = hit.isRock
    inputs[base + 3] = hit.isBullet
  }

  return inputs
}
