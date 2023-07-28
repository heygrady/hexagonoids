import { degToRad, radToDeg } from './degToRad'
import type { GeoCoord } from './geoToVector3'

export const calculateDistance = (
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
  radius: number = 1
) => {
  // Convert latitudes and longitudes to radians
  const lat1Rad = degToRad(lat1)
  const lng1Rad = degToRad(lng1)
  const lat2Rad = degToRad(lat2)
  const lng2Rad = degToRad(lng2)

  // Calculate differences
  const latDiff = lat2Rad - lat1Rad
  const lonDiff = lng2Rad - lng1Rad

  // Apply Haversine formula
  const a =
    Math.sin(latDiff / 2) ** 2 +
    Math.cos(lat1Rad) * Math.cos(lat2Rad) * Math.sin(lonDiff / 2) ** 2
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  const distance = radius * c

  return distance
}

export const calculateMidpoint = (
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): GeoCoord => {
  // Convert latitudes and longitudes to radians
  const lat1Rad = degToRad(lat1)
  const lng1Rad = degToRad(lng1)
  const lat2Rad = degToRad(lat2)
  const lng2Rad = degToRad(lng2)

  // Calculate the deltas
  const deltaLon = lng2Rad - lng1Rad

  // Calculate the midpoint coordinates
  const bx = Math.cos(lat2Rad) * Math.cos(deltaLon)
  const by = Math.cos(lat2Rad) * Math.sin(deltaLon)
  const latMidRad = Math.atan2(
    Math.sin(lat1Rad) + Math.sin(lat2Rad),
    Math.sqrt((Math.cos(lat1Rad) + bx) * (Math.cos(lat1Rad) + bx) + by * by)
  )
  const lngMidRad = lng1Rad + Math.atan2(by, Math.cos(lat1Rad) + bx)

  return { lat: radToDeg(latMidRad), lng: radToDeg(lngMidRad) }
}
