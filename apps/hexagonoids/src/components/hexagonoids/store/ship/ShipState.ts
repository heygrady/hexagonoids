import { Vector3 } from '@babylonjs/core/Maths/math.vector'
import type { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh'
import type { TransformNode } from '@babylonjs/core/Meshes/transformNode'

import type { ControlStore } from '../control/ControlStore'
import type { PlayerStore } from '../player/PlayerStore'

export interface ShipState {
  id?: string

  /** A ship segment is exploded */
  type: 'ship' | 'segment'

  /** Determines the point value of the ship. */
  value?: number

  /** Rotation of the ship relative to the heading in radians. Ranges from -Math.PI to Math.PI. Controls the forward facing direction the ship. */
  yaw: number

  /**
   * Angular velocity of the ship as a 3D vector.
   * Direction: axis of rotation on the sphere
   * Magnitude: angular speed in radians per second
   * Represents velocity as angular velocity ω for quaternion-based spherical physics.
   */
  angularVelocity: Vector3

  /** Latitude in degrees on the surface of the sphere. Controls the position of the ship */
  lat: number

  /** Longitude in degrees on the surface of the sphere. Controls the position of the ship */
  lng: number

  // FIXME: check if this is used
  /** Timestamp in milliseconds when a projectile was last fired (one fire per keypress, max fire per second)  */
  firedAt: number | null
  generatedAt: number | null

  originNode: TransformNode | null
  positionNode: TransformNode | null
  orientationNode: TransformNode | null
  shipNode: AbstractMesh | null
  shipTailNode: AbstractMesh | null

  $control: ControlStore | null
  $player: PlayerStore | null
}

export const defaultShipState: ShipState = {
  yaw: 0,
  type: 'ship',
  angularVelocity: Vector3.Zero(),
  lat: 64.02353135675048, // 45, {lat: 64.02353135675048, lng: 8.546754407239742}
  lng: 8.546754407239742, // 45,
  firedAt: null,
  generatedAt: null,
  originNode: null,
  positionNode: null,
  orientationNode: null,
  shipNode: null,
  shipTailNode: null,
  $player: null,
  $control: null,
}
