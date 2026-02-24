const DEG_TO_RAD = Math.PI / 180

/**
 * Compute the initial bearing (forward azimuth) from point A to point B
 * on the sphere surface. Inputs are in degrees, output is in radians [-PI, PI].
 * 0 = north, positive = clockwise.
 */
export function sphericalBearing(
  lat1Deg: number,
  lng1Deg: number,
  lat2Deg: number,
  lng2Deg: number
): number {
  const phi1 = lat1Deg * DEG_TO_RAD
  const phi2 = lat2Deg * DEG_TO_RAD
  const deltaLambda = (lng2Deg - lng1Deg) * DEG_TO_RAD

  const y = Math.sin(deltaLambda) * Math.cos(phi2)
  const x =
    Math.cos(phi1) * Math.sin(phi2) -
    Math.sin(phi1) * Math.cos(phi2) * Math.cos(deltaLambda)

  return Math.atan2(y, x)
}

/**
 * Compute the bearing from ship to target relative to the ship's heading.
 * Returns radians in [-PI, PI]. 0 = ahead, positive = right, negative = left.
 */
export function relativeBearing(absoluteBearing: number, yaw: number): number {
  let rel = absoluteBearing - yaw
  while (rel > Math.PI) rel -= 2 * Math.PI
  while (rel < -Math.PI) rel += 2 * Math.PI
  return rel
}
