const RAD_TO_DEG = 180 / Math.PI

/**
 * Compute destination point on unit sphere from origin XYZ, yaw, and angular distance.
 * Uses Rodrigues' rotation formula — all XYZ, no lat/lng.
 * Returns [x, y, z] on unit sphere.
 *
 * Uses the engine's yaw convention: 0 = east, positive = clockwise (right turn).
 *
 * @param ox - origin x on unit sphere
 * @param oy - origin y on unit sphere
 * @param oz - origin z on unit sphere
 * @param yaw - radians, 0=east, clockwise positive (engine convention)
 * @param angularDistance - radians along great circle
 */
export function destinationOnSphere(
  ox: number,
  oy: number,
  oz: number,
  yaw: number,
  angularDistance: number
): [x: number, y: number, z: number] {
  // Build local tangent-plane basis at origin.
  // "North" = direction toward the pole projected onto tangent plane.
  // Engine uses y-up, so the pole is (0, 1, 0).

  // Up vector at origin (same as origin on unit sphere)
  // East = cross(pole, origin) normalized
  // If origin is at a pole, east is arbitrary — use (1,0,0)×origin as fallback.
  const poleX = 0
  const poleY = 1
  const poleZ = 0

  // east = cross(origin, pole) — matches engine's geographic east convention
  let eastX = oy * poleZ - oz * poleY
  let eastY = oz * poleX - ox * poleZ
  let eastZ = ox * poleY - oy * poleX

  let eastLen = Math.sqrt(eastX * eastX + eastY * eastY + eastZ * eastZ)
  if (eastLen < 1e-12) {
    // Origin is at or near a pole — pick an arbitrary tangent
    eastX = 1
    eastY = 0
    eastZ = 0
    eastLen = 1
  }
  eastX /= eastLen
  eastY /= eastLen
  eastZ /= eastLen

  // north = cross(east, origin) — tangent pointing toward pole
  let northX = eastY * oz - eastZ * oy
  let northY = eastZ * ox - eastX * oz
  let northZ = eastX * oy - eastY * ox
  const northLen = Math.sqrt(
    northX * northX + northY * northY + northZ * northZ
  )
  northX /= northLen
  northY /= northLen
  northZ /= northLen

  // Engine yaw convention: 0=east, positive=clockwise
  // Direction in tangent plane: east * cos(yaw) - north * sin(yaw)
  const cy = Math.cos(yaw)
  const sy = Math.sin(yaw)
  const dirX = eastX * cy - northX * sy
  const dirY = eastY * cy - northY * sy
  const dirZ = eastZ * cy - northZ * sy

  // Rodrigues' rotation: rotate origin around dir × origin axis by angularDistance
  // Result = origin * cos(d) + dir * sin(d)
  // (This works because dir is tangent at origin, both unit length, and perpendicular)
  const cd = Math.cos(angularDistance)
  const sd = Math.sin(angularDistance)

  return [ox * cd + dirX * sd, oy * cd + dirY * sd, oz * cd + dirZ * sd]
}

/**
 * Compute the local heading (radians) at position (rx,ry,rz) pointing toward (sx,sy,sz).
 * Both points on unit sphere. Returns heading compatible with spawnRock's localHeading param.
 *
 * The heading is measured in the tangent plane at (rx,ry,rz), with 0 = "forward"
 * in the engine's local frame (matching how headingToAngularVelocity interprets it).
 */
export function headingToward(
  rx: number,
  ry: number,
  rz: number,
  sx: number,
  sy: number,
  sz: number
): number {
  // Direction from r to s, projected onto tangent plane at r
  // Tangent projection: v - dot(v, r) * r
  const dx = sx - rx
  const dy = sy - ry
  const dz = sz - rz

  const dot = dx * rx + dy * ry + dz * rz
  let tx = dx - dot * rx
  let ty = dy - dot * ry
  let tz = dz - dot * rz

  const tLen = Math.sqrt(tx * tx + ty * ty + tz * tz)
  if (tLen < 1e-12) return 0
  tx /= tLen
  ty /= tLen
  tz /= tLen

  // Build local frame matching the engine's yaw convention (0=east, CW positive).
  //   lat = asin(ry), lng = atan2(rz, rx)
  const lat = Math.asin(Math.max(-1, Math.min(1, ry)))
  const lng = Math.atan2(rz, rx)

  const sinLat = Math.sin(lat)
  const cosLng = Math.cos(lng)
  const sinLng = Math.sin(lng)

  // East = d/dLng normalized = (-sinLng, 0, cosLng)
  // This is the engine's forward direction (yaw=0).
  const fwdX = -sinLng
  const fwdY = 0
  const fwdZ = cosLng

  // South = -north = -(d/dLat) = (sinLat*cosLng, -cosLat, sinLat*sinLng)
  // This is the engine's right direction (CW from east).
  const cosLat = Math.cos(lat)
  const rightX = sinLat * cosLng
  const rightY = -cosLat
  const rightZ = sinLat * sinLng

  // heading = atan2(dot(tangent, right), dot(tangent, forward))
  const dotFwd = tx * fwdX + ty * fwdY + tz * fwdZ
  const dotRight = tx * rightX + ty * rightY + tz * rightZ

  return Math.atan2(dotRight, dotFwd)
}

/**
 * Convert unit-sphere XYZ to lat/lng in degrees.
 * Equivalent to engine's unitPointToLatLng (not exported from engine).
 */
export function unitPointToLatLng(
  x: number,
  y: number,
  z: number
): [lat: number, lng: number] {
  const lat = Math.asin(Math.max(-1, Math.min(1, y))) * RAD_TO_DEG
  const lng = Math.atan2(z, x) * RAD_TO_DEG
  return [lat, lng]
}
