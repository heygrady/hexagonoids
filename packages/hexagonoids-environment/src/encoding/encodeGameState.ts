import type {
  GameState,
  ManagedSpatialQueries,
} from '@heygrady/hexagonoids-engine'
import type { RockPerceptionPrecompute } from './collectObservations.js'
import { collectObservations } from './collectObservations.js'
import {
  BULLET_SLOTS,
  CONE_COUNT,
  FEATURES_PER_BULLET,
  FEATURES_PER_CONE,
  FEATURES_PER_ROCK,
  GLOBAL_FEATURES,
  INPUT_COUNT,
  ROCKS_PER_CONE,
} from './encodingPresets.js'
import type { ObservationFrame } from './observationTypes.js'

/**
 * Encode game state into a fixed-size vector.
 *
 * Layout:
 * [0] ship.velocityX    [1] ship.velocityY
 * [2..65]  8 cones × 2 rocks × 4: proximity, bearing, velocityX, velocityY
 * [66..89] 6 bullet slots × 4: proximity, bearing, velocityX, velocityY
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
    for (let j = 0; j < ROCKS_PER_CONE; j++) {
      const hitIndex = i * ROCKS_PER_CONE + j
      const hit = obs.lidar[hitIndex]!
      const base =
        GLOBAL_FEATURES + i * FEATURES_PER_CONE + j * FEATURES_PER_ROCK
      inputs[base] = hit.proximity
      inputs[base + 1] = hit.bearing
      inputs[base + 2] = hit.velocityX
      inputs[base + 3] = hit.velocityY
    }
  }

  const bulletBase = GLOBAL_FEATURES + CONE_COUNT * FEATURES_PER_CONE
  for (let i = 0; i < BULLET_SLOTS; i++) {
    const bHit = obs.bullets[i]!
    const base = bulletBase + i * FEATURES_PER_BULLET
    inputs[base] = bHit.proximity
    inputs[base + 1] = bHit.bearing
    inputs[base + 2] = bHit.velocityX
    inputs[base + 3] = bHit.velocityY
  }

  return inputs
}
