import type { CoordPair } from 'h3-js'
import { action } from 'nanostores'
import type { OmitFirstArg } from 'nanostores/action'

import { wrapHalfCircle } from '../../ship/orientation'

import type { ShipState } from './ShipState'
import type { ShipStore } from './ShipStore'

export interface ShipSetters {
  setYaw: OmitFirstArg<typeof setYaw>
  setAngularVelocity: OmitFirstArg<typeof setAngularVelocity>
  setLat: OmitFirstArg<typeof setLat>
  setLng: OmitFirstArg<typeof setLng>
  setLocation: OmitFirstArg<typeof setLocation>
  setFiredAt: OmitFirstArg<typeof setFiredAt>
}

export const bindShipSetters = ($ship: ShipStore): ShipSetters => ({
  setYaw: action($ship, 'setYaw', setYaw),
  setAngularVelocity: action($ship, 'setAngularVelocity', setAngularVelocity),
  setLat: action($ship, 'setLat', setLat),
  setLng: action($ship, 'setLng', setLng),
  setLocation: action($ship, 'setLocation', setLocation),
  setFiredAt: action($ship, 'setFiredAt', setFiredAt),
})

/**
 * Sets the rotation of the ship relative to the heading in radians.
 * @param {ShipStore} $ship - The ship store
 * @param {number} yaw - Rotation of the ship relative to the heading in radians. Ranges from -Math.PI to Math.PI. Controls the forward facing direction the ship.
 */
export const setYaw = ($ship: ShipStore, yaw: ShipState['yaw']) => {
  const prev = $ship.get().yaw
  if (prev !== yaw) {
    $ship.setKey('yaw', wrapHalfCircle(yaw))
  }
}

/**
 * Sets the angular velocity of the ship.
 * @param {ShipStore} $ship - The ship store
 * @param {any} angularVelocity - Angular velocity as a 3D vector (axis × magnitude)
 */
export const setAngularVelocity = (
  $ship: ShipStore,
  angularVelocity: ShipState['angularVelocity']
) => {
  const prev = $ship.get().angularVelocity
  if (!prev.equals(angularVelocity)) {
    $ship.setKey('angularVelocity', angularVelocity.clone())
  }
}

export const setLat = ($ship: ShipStore, lat: ShipState['lat']) => {
  const prev = $ship.get().lat
  if (prev !== lat) {
    // FIXME: ensure proper range
    $ship.setKey('lat', lat)
  }
}

export const setLng = ($ship: ShipStore, lng: ShipState['lng']) => {
  const prev = $ship.get().lng
  if (prev !== lng) {
    // FIXME: ensure proper range
    $ship.setKey('lng', lng)
  }
}

export const setLocation = ($ship: ShipStore, location: CoordPair) => {
  setLat($ship, location[0])
  setLng($ship, location[1])
}

export const setFiredAt = ($ship: ShipStore, now?: number) => {
  const firedAt = now ?? Date.now()
  const prev = $ship.get().firedAt
  if (prev !== firedAt) {
    $ship.setKey('firedAt', firedAt)
  }
}
export const setGeneratedAt = ($ship: ShipStore, now?: number) => {
  const generatedAt = now ?? Date.now()
  const prev = $ship.get().generatedAt
  if (prev !== generatedAt) {
    $ship.setKey('generatedAt', generatedAt)
  }
}
