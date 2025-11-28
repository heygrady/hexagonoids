import { Vector3 } from '@babylonjs/core/Maths/math.vector'
import type { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh'
import type { TransformNode } from '@babylonjs/core/Meshes/transformNode'

import {
  ROCK_LARGE_SIZE,
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

  /** Visual rotation of the rock (separate from movement direction). */
  yaw: number

  /**
   * Angular velocity of the rock as a 3D vector.
   * Direction: axis of rotation on the sphere
   * Magnitude: angular speed in radians per second
   * Represents velocity as angular velocity ω for quaternion-based spherical physics.
   */
  angularVelocity: Vector3

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
  angularVelocity: Vector3.Zero(),
  lat: 0,
  lng: 0,
  cells: new Set(),
  originNode: null,
  orientationNode: null,
  rockNode: null,
}
