import type { AbstractMesh, TransformNode } from '@babylonjs/core'

import {
  BULLET_SPEED,
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

  /** Direction of the bullet velocity in radians. Ranges from -Math.PI to Math.PI. */
  heading: number

  /** Magnitude of the velocity of the bullet in radians per second. Ranges from 0 to MAX_SPEED. */
  speed: number

  /** Latitude in degrees on the surface of the sphere. */
  lat: number

  /** Longitude in degrees on the surface of the sphere. */
  lng: number

  /** Timestamp in milliseconds when the was fired */
  firedAt: number | null

  originNode: TransformNode | null
  bulletNode: AbstractMesh | null

  /** Ship that fired the bullet. Explosions are null */
  $ship: ShipStore | null
}

export const defaultBulletState: BulletState = {
  type: 'bullet',
  size: null,
  heading: 0,
  speed: BULLET_SPEED,
  lat: 0,
  lng: 0,
  firedAt: null,
  originNode: null,
  bulletNode: null,
  $ship: null,
}
