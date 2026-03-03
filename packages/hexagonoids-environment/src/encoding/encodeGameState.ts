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
  DEFAULT_ENCODING_PRESET,
  INPUT_COUNT as DEFAULT_INPUT_COUNT,
  type EncodingPreset,
  GLOBAL_FEATURES,
  getEncodingFeaturesPerRay,
  getInputCountForEncoding,
  getLidarRayCount,
} from './encodingPresets.js'
import type { ObservationFrame } from './observationTypes.js'

/** Total number of input floats produced by the default encoding preset. */
export const INPUT_COUNT = DEFAULT_INPUT_COUNT

/**
 * Encode game state into a fixed-size vector.
 *
 * Layout (`four`: 69, `five`: 85, `six`: 101, `cone8`: 37):
 * [0] speed_norm
 * [1] heading_forward_drift
 * [2] heading_lateral_drift
 * [3] angular_velocity_norm
 * [4] cooldown_norm
 * [5..] rays x N:
 *   `four`: 16 rays x 4: proximity, closing_speed, rock_size_norm, bearing_offset_norm
 *   `five`: 16 rays x 5: proximity, closing_speed, rock_size_norm, bearing_offset_norm,
 *           bearing_drift_norm
 *   `six`:  16 rays x 6: proximity, closing_speed, rock_size_norm, bearing_offset_norm,
 *           center_weight, bearing_drift_norm
 *   `cone8`: 8 cones x 4: proximity, lateral_offset, radial_velocity, tangential_velocity
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
  encodingPreset: EncodingPreset = DEFAULT_ENCODING_PRESET,
  spatialQueries?: Pick<ManagedSpatialQueries, 'queryRocksNear'>
): number[] {
  const obs = collectObservations(
    state,
    playerId,
    prevProjections,
    prevDistances,
    dtMs,
    observationsBuffer,
    rockPerceptionBuffer,
    encodingPreset,
    spatialQueries
  )
  const featuresPerRay = getEncodingFeaturesPerRay(encodingPreset)
  const inputCount = getInputCountForEncoding(encodingPreset)
  const inputs =
    inputsBuffer != null && inputsBuffer.length === inputCount
      ? inputsBuffer
      : new Array<number>(inputCount)

  inputs[0] = obs.ship.speedNorm
  inputs[1] = obs.ship.headingForwardDrift
  inputs[2] = obs.ship.headingLateralDrift
  inputs[3] = obs.ship.angularVelocityNorm
  inputs[4] = obs.temporal.cooldownNorm

  const rayCount = getLidarRayCount(encodingPreset)
  for (let i = 0; i < rayCount; i++) {
    const hit = obs.lidar[i]!
    const base = GLOBAL_FEATURES + i * featuresPerRay

    if (encodingPreset === 'cone8') {
      inputs[base] = 1 - hit.distanceNorm
      inputs[base + 1] = hit.bearingOffsetNorm
      inputs[base + 2] = hit.closingSpeed
      inputs[base + 3] = hit.tangentialSpeed
    } else {
      inputs[base] = 1 - hit.distanceNorm
      inputs[base + 1] = hit.closingSpeed
      inputs[base + 2] = hit.rockSizeNorm
      inputs[base + 3] = hit.bearingOffsetNorm

      if (encodingPreset === 'five') {
        inputs[base + 4] = hit.bearingDriftNorm
      } else if (encodingPreset === 'six') {
        inputs[base + 4] = hit.centerWeight
        inputs[base + 5] = hit.bearingDriftNorm
      }
    }
  }

  return inputs
}
