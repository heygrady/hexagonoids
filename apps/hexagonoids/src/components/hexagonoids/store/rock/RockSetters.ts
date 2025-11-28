import type { CoordPair } from 'h3-js'
import { action } from 'nanostores'
import type { OmitFirstArg } from 'nanostores/action'

import { storeToCells } from '../../colission/storeToCells'
import { wrapHalfCircle } from '../../ship/orientation'

import type { RockState } from './RockState'
import type { RockStore } from './RockStore'

export interface RockSetters {
  setYaw: OmitFirstArg<typeof setYaw>
  setAngularVelocity: OmitFirstArg<typeof setAngularVelocity>
  setLat: OmitFirstArg<typeof setLat>
  setLng: OmitFirstArg<typeof setLng>
  setLocation: OmitFirstArg<typeof setLocation>
}

export const bindRockSetters = ($rock: RockStore): RockSetters => ({
  setYaw: action($rock, 'setYaw', setYaw),
  setAngularVelocity: action($rock, 'setAngularVelocity', setAngularVelocity),
  setLat: action($rock, 'setLat', setLat),
  setLng: action($rock, 'setLng', setLng),
  setLocation: action($rock, 'setLocation', setLocation),
})

/**
 * Sets the yaw (visual rotation) of the rock.
 * @param {RockStore} $rock - The rock store
 * @param {number} yaw - Visual rotation in radians (-π to π)
 */
export const setYaw = ($rock: RockStore, yaw: RockState['yaw']) => {
  const prev = $rock.get().yaw
  if (prev !== yaw) {
    $rock.setKey('yaw', wrapHalfCircle(yaw))
  }
}

/**
 * Sets the angular velocity of the rock.
 * @param {RockStore} $rock - The rock store
 * @param {any} angularVelocity - Angular velocity as a 3D vector (axis × magnitude)
 */
export const setAngularVelocity = (
  $rock: RockStore,
  angularVelocity: RockState['angularVelocity']
) => {
  const prev = $rock.get().angularVelocity
  if (!prev.equals(angularVelocity)) {
    $rock.setKey('angularVelocity', angularVelocity.clone())
  }
}

export const setLat = ($rock: RockStore, lat: RockState['lat']) => {
  const prev = $rock.get().lat
  if (prev !== lat) {
    // FIXME: ensure proper range
    $rock.setKey('lat', lat)
  }
}

export const setLng = ($rock: RockStore, lng: RockState['lng']) => {
  const prev = $rock.get().lng
  if (prev !== lng) {
    // FIXME: ensure proper range
    $rock.setKey('lng', lng)
  }
}

export const setLocation = ($rock: RockStore, location: CoordPair) => {
  setLat($rock, location[0])
  setLng($rock, location[1])
}

export const setCells = ($rock: RockStore) => {
  // const { cells, lat, lng } = $rock.get()
  // const h = latLngToCell(lat, lng, 1)
  // const disk = gridDisk(h, 1)
  // cells.clear()
  // for (const h of disk) {
  //   cells.add(h)
  // }
  const cells = storeToCells($rock, 1, true)
  $rock.setKey('cells', cells)
}
