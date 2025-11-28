import { Vector3 } from '@babylonjs/core/Maths/math.vector'
import type { InstancedMesh } from '@babylonjs/core/Meshes/instancedMesh'
import type { TransformNode } from '@babylonjs/core/Meshes/transformNode'

import {
  type ROCK_LARGE_SIZE,
  type ROCK_MEDIUM_SIZE,
  type ROCK_SMALL_SIZE,
} from '../../constants'
import type { ShipStore } from '../ship/ShipStore'

export interface BulletState {
  id?: string

  type: 'bullet' | 'explosion'

  /** Size of the explosion. Bullets are null */
  size:
    | typeof ROCK_LARGE_SIZE
    | typeof ROCK_MEDIUM_SIZE
    | typeof ROCK_SMALL_SIZE
    | null

  /**
   * Angular velocity of the bullet as a 3D vector.
   * Direction: axis of rotation on the sphere
   * Magnitude: angular speed in radians per second
   * Represents velocity as angular velocity ω for quaternion-based spherical physics.
   */
  angularVelocity: Vector3

  /** Latitude in degrees on the surface of the sphere. */
  lat: number

  /** Longitude in degrees on the surface of the sphere. */
  lng: number

  /** Timestamp in milliseconds when the was fired */
  firedAt: number | null

  originNode: TransformNode | null
  bulletNode: InstancedMesh | null

  /** Ship that fired the bullet. Explosions are null */
  $ship: ShipStore | null
}

export const defaultBulletState: BulletState = {
  type: 'bullet',
  size: null,
  angularVelocity: Vector3.Zero(),
  lat: 0,
  lng: 0,
  firedAt: null,
  originNode: null,
  bulletNode: null,
  $ship: null,
}
