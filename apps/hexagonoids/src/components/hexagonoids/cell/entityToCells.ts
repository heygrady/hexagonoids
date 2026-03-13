import { Vector3 } from '@babylonjs/core/Maths/math.vector'
import { vector3ToLatLng } from '@heygrady/h3-babylon'
import { latLngToCell } from 'h3-js'

const CELL_RESOLUTION = 1

/**
 * Returns the H3 cell containing the entity at the given unit point.
 */
export const entityToCell = (x: number, y: number, z: number): string => {
  const [lat, lng] = vector3ToLatLng(new Vector3(x, y, z))
  return latLngToCell(lat, lng, CELL_RESOLUTION)
}
