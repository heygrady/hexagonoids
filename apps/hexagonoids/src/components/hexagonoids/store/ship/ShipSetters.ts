import { action } from 'nanostores'
import type { OmitFirstArg } from 'nanostores/action'

import { MAX_SPEED } from '../../constants'
import type { GeoCoord } from '../../geoCoords/geoToVector3'
import { wrapHalfCircle } from '../../ship/orientation'

import type { ShipState } from './ShipState'
import type { ShipStore } from './ShipStore'

export interface ShipSetters {
  setYaw: OmitFirstArg<typeof setYaw>
  setHeading: OmitFirstArg<typeof setHeading>
  setSpeed: OmitFirstArg<typeof setSpeed>
  setHeadingSpeed: OmitFirstArg<typeof setHeadingSpeed>
  setLat: OmitFirstArg<typeof setLat>
  setLng: OmitFirstArg<typeof setLng>
  setLocation: OmitFirstArg<typeof setLocation>
  setFiredAt: OmitFirstArg<typeof setFiredAt>
}

export const bindShipSetters = ($ship: ShipStore): ShipSetters => ({
  setYaw: action($ship, 'setYaw', setYaw),
  setHeading: action($ship, 'setHeading', setHeading),
  setSpeed: action($ship, 'setSpeed', setSpeed),
  setHeadingSpeed: action($ship, 'setHeadingSpeed', setHeadingSpeed),
  setLat: action($ship, 'setLat', setLat),
  setLng: action($ship, 'setLng', setLng),
  setLocation: action($ship, 'setLocation', setLocation),
  setFiredAt: action($ship, 'setFiredAt', setFiredAt),
})

/**
 * Sets the rotation of the ship relative to the heading in radians.
 * @param $ship
 * @param yaw Rotation of the ship relative to the heading in radians. Ranges from -Math.PI to Math.PI. Controls the forward facing direction the ship.
 */
export const setYaw = ($ship: ShipStore, yaw: ShipState['yaw']) => {
  const prev = $ship.get().yaw
  if (prev !== yaw) {
    $ship.setKey('yaw', wrapHalfCircle(yaw))
  }
}

/**
 * Sets the direction of the ship velocity in radians.
 * @param $ship
 * @param heading Direction of the ship velocity in radians. Ranges from -Math.PI to Math.PI.
 */
export const setHeading = ($ship: ShipStore, heading: ShipState['heading']) => {
  const prev = $ship.get().heading
  if (prev !== heading) {
    // wrap heading to -Math.PI to Math.PI
    $ship.setKey('heading', wrapHalfCircle(heading))
  }
}

/**
 * Sets the speed of the ship as radians per second.
 * @param $ship
 * @param speed Speed of the ship as radians per second. Ranges from 0 to MAX_SPEED.
 */
export const setSpeed = ($ship: ShipStore, speed: ShipState['speed']) => {
  const prev = $ship.get().speed
  if (prev !== speed) {
    // enforce speed limits
    $ship.setKey('speed', Math.min(Math.max(speed, 0), MAX_SPEED))
  }
}

/**
 * Sets the direction of the ship in radians and the speed of the ship as radians per second.
 * @param $ship
 * @param heading Direction of the ship velocity in radians. Ranges from -Math.PI to Math.PI.
 * @param speed Speed of the ship as radians per second. Ranges from 0 to MAX_SPEED.
 */
export const setHeadingSpeed = (
  $ship: ShipStore,
  heading: number,
  speed: number
) => {
  setHeading($ship, heading)
  setSpeed($ship, speed)
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

export const setLocation = ($ship: ShipStore, location: GeoCoord) => {
  setLat($ship, location.lat)
  setLng($ship, location.lng)
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
