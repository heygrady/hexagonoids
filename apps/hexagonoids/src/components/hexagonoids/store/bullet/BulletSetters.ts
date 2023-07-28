import type { GeoCoord } from '../../geoCoords/geoToVector3'

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

export const setLocation = ($bullet: BulletStore, location: GeoCoord) => {
  setLat($bullet, location.lat)
  setLng($bullet, location.lng)
}
