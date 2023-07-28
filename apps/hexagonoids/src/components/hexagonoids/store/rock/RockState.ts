import type { AbstractMesh, TransformNode } from '@babylonjs/core'

import {
  ROCK_LARGE_SIZE,
  ROCK_LARGE_SPEED,
  ROCK_LARGE_VALUE,
  type ROCK_MEDIUM_SIZE,
  type ROCK_SMALL_SIZE,
} from '../../constants'

export interface RockState {
  id?: string

  // FIXME: this isn't used
  /** Classification of the the rock. */
  type?: string

  /** Determines the scale of the rock. 2 is the largest rock, 0 is the smallest */
  size:
    | typeof ROCK_LARGE_SIZE
    | typeof ROCK_MEDIUM_SIZE
    | typeof ROCK_SMALL_SIZE

  /** Determines the point value of the rock. 200 | 100 | 50 */
  value: number

  /** Rotation of the rock relative to the heading in radians. Ranges from -Math.PI to Math.PI. */
  yaw: number

  /** Direction of the rock velocity in radians. Ranges from -Math.PI to Math.PI. */
  heading: number

  /** Magnitude of the velocity of the rock in radians per second. Ranges from 0 to MAX_SPEED. */
  speed: number

  /** Latitude in degrees on the surface of the sphere. */
  lat: number

  /** Longitude in degrees on the surface of the sphere. */
  lng: number

  cells: Set<string>

  originNode: TransformNode | null
  orientationNode: TransformNode | null
  rockNode: AbstractMesh | null
}

export const defaultRockState: RockState = {
  size: ROCK_LARGE_SIZE,
  value: ROCK_LARGE_VALUE,
  yaw: 0,
  heading: 0,
  speed: ROCK_LARGE_SPEED,
  lat: 0,
  lng: 0,
  cells: new Set(),
  originNode: null,
  orientationNode: null,
  rockNode: null,
}
