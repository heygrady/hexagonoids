import type { CoordPair } from 'h3-js'
import { action } from 'nanostores'
import type { OmitFirstArg } from 'nanostores/action'

import { storeToCells } from '../../colission/storeToCells'
import { wrapHalfCircle } from '../../ship/orientation'

import type { RockState } from './RockState'
import type { RockStore } from './RockStore'

export interface RockSetters {
  setYaw: OmitFirstArg<typeof setYaw>
  setHeading: OmitFirstArg<typeof setHeading>
  setLat: OmitFirstArg<typeof setLat>
  setLng: OmitFirstArg<typeof setLng>
  setLocation: OmitFirstArg<typeof setLocation>
}

export const bindRockSetters = ($rock: RockStore): RockSetters => ({
  setYaw: action($rock, 'setYaw', setYaw),
  setHeading: action($rock, 'setHeading', setHeading),
  setLat: action($rock, 'setLat', setLat),
  setLng: action($rock, 'setLng', setLng),
  setLocation: action($rock, 'setLocation', setLocation),
})

/**
 * Sets the rotation of the rock relative to the heading in radians.
 * @param $rock
 * @param yaw Rotation of the rock relative to the heading in radians. Ranges from -Math.PI to Math.PI. Controls the forward facing direction the rock.
 */
export const setYaw = ($rock: RockStore, yaw: RockState['yaw']) => {
  const prev = $rock.get().yaw
  if (prev !== yaw) {
    $rock.setKey('yaw', wrapHalfCircle(yaw))
  }
}

/**
 * Sets the direction of the rock velocity in radians.
 * @param $rock
 * @param heading Direction of the rock velocity in radians. Ranges from -Math.PI to Math.PI.
 */
export const setHeading = ($rock: RockStore, heading: RockState['heading']) => {
  const prev = $rock.get().heading
  if (prev !== heading) {
    // wrap heading to -Math.PI to Math.PI
    $rock.setKey('heading', wrapHalfCircle(heading))
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
