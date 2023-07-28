import type { AbstractMesh, TransformNode } from '@babylonjs/core'

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

  /** Direction of the ship velocity in radians. Ranges from -Math.PI to Math.PI. Controls the direction of the velocity of the ship, AKA the yaw. */
  heading: number

  /** Speed of the ship as radians per second. Ranges from 0 to MAX_SPEED. Controls the magnitude of the velocity of the ship, AKA pitch. */
  speed: number

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
  // FIXME: move these to the constants file
  heading: 0,
  speed: 0,
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
