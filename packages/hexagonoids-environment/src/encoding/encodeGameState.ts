import type {
  GameState,
  ManagedSpatialQueries,
} from '@heygrady/hexagonoids-engine'
import type {
  PreviousRockProjectionMap,
  RockPerceptionPrecompute,
} from './collectObservations.js'
import { collectObservations } from './collectObservations.js'
import {
  CONE_COUNT,
  FEATURES_PER_CONE,
  GLOBAL_FEATURES,
  INPUT_COUNT,
} from './encodingPresets.js'
import type { ObservationFrame } from './observationTypes.js'

export { INPUT_COUNT } from './encodingPresets.js'

/**
 * Encode game state into a fixed-size vector of 37 floats.
 *
 * Layout (cone8: 5 global + 8 cones x 4):
 * [0] speed_norm
 * [1] heading_forward_drift
 * [2] heading_lateral_drift
 * [3] angular_velocity_norm
 * [4] cooldown_norm
 * [5..] 8 cones x 4: proximity, lateral_offset, radial_velocity, tangential_velocity
 */
export function encodeGameState(
  state: GameState,
  playerId: string,
  prevProjections: PreviousRockProjectionMap | undefined,
  prevDistances: Map<string, number>,
  dtMs: number,
  inputsBuffer?: number[],
  observationsBuffer?: ObservationFrame,
  rockPerceptionBuffer?: RockPerceptionPrecompute,
  spatialQueries?: Pick<ManagedSpatialQueries, 'queryRocksNear'>,
  seenRocks?: Set<string>
): number[] {
  const obs = collectObservations(
    state,
    playerId,
    prevProjections,
    prevDistances,
    dtMs,
    observationsBuffer,
    rockPerceptionBuffer,
    spatialQueries,
    seenRocks
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

  for (let i = 0; i < CONE_COUNT; i++) {
    const hit = obs.lidar[i]!
    const base = GLOBAL_FEATURES + i * FEATURES_PER_CONE
    inputs[base] = 1 - hit.distanceNorm
    inputs[base + 1] = hit.bearingOffsetNorm
    inputs[base + 2] = hit.closingSpeed
    inputs[base + 3] = hit.tangentialSpeed
  }

  return inputs
}
