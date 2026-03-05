import type {
  GameState,
  ManagedSpatialQueries,
} from '@heygrady/hexagonoids-engine'
import type { RockPerceptionPrecompute } from './collectObservations.js'
import { collectObservations } from './collectObservations.js'
import {
  CONE_COUNT,
  FEATURES_PER_CONE,
  GLOBAL_FEATURES,
  INPUT_COUNT,
} from './encodingPresets.js'
import type { ObservationFrame } from './observationTypes.js'

/**
 * Encode game state into a fixed-size vector of 34 floats.
 *
 * Layout:
 * [0] ship.velocityX    [1] ship.velocityY
 * [2..33] 8 cones × 4: proximity, bearing, velocityX, velocityY
 */
export function encodeGameState(
  state: GameState,
  playerId: string,
  inputsBuffer?: number[],
  observationsBuffer?: ObservationFrame,
  rockPerceptionBuffer?: RockPerceptionPrecompute,
  spatialQueries?: Pick<ManagedSpatialQueries, 'queryRocksNear'>,
  seenRocks?: Set<string>
): number[] {
  const obs = collectObservations(
    state,
    playerId,
    observationsBuffer,
    rockPerceptionBuffer,
    spatialQueries,
    seenRocks
  )
  const inputs =
    inputsBuffer != null && inputsBuffer.length === INPUT_COUNT
      ? inputsBuffer
      : new Array<number>(INPUT_COUNT)

  inputs[0] = obs.ship.velocityX
  inputs[1] = obs.ship.velocityY

  for (let i = 0; i < CONE_COUNT; i++) {
    const hit = obs.lidar[i]!
    const base = GLOBAL_FEATURES + i * FEATURES_PER_CONE
    inputs[base] = hit.proximity
    inputs[base + 1] = hit.bearing
    inputs[base + 2] = hit.velocityX
    inputs[base + 3] = hit.velocityY
  }

  return inputs
}
