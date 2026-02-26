import { latLngToCell } from 'h3-js'

const CELL_RESOLUTION = 1

/**
 * Returns the H3 cell containing the entity at the given lat/lng.
 */
export const entityToCell = (lat: number, lng: number): string => {
  return latLngToCell(lat, lng, CELL_RESOLUTION)
}
