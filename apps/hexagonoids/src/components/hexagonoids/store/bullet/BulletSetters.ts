import type { CoordPair } from 'h3-js'

import type { BulletState } from './BulletState'
import type { BulletStore } from './BulletStore'

export const setLat = ($bullet: BulletStore, lat: BulletState['lat']) => {
  const prev = $bullet.get().lat
  if (prev !== lat) {
    // FIXME: ensure proper range
    $bullet.setKey('lat', lat)
  }
}

export const setLng = ($bullet: BulletStore, lng: BulletState['lng']) => {
  const prev = $bullet.get().lng
  if (prev !== lng) {
    // FIXME: ensure proper range
    $bullet.setKey('lng', lng)
  }
}

export const setLocation = ($bullet: BulletStore, location: CoordPair) => {
  setLat($bullet, location[0])
  setLng($bullet, location[1])
}

export const setAngularVelocity = (
  $bullet: BulletStore,
  angularVelocity: BulletState['angularVelocity']
) => {
  const prev = $bullet.get().angularVelocity
  if (!prev.equals(angularVelocity)) {
    $bullet.setKey('angularVelocity', angularVelocity.clone())
  }
}
