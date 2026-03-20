import type { Quat, Vec3 } from './types.js'

/** Copy src into dst. */
export function quatCopy(dst: Quat, src: Quat): void {
  dst[0] = src[0]
  dst[1] = src[1]
  dst[2] = src[2]
  dst[3] = src[3]
}

/** Set dst to (x, y, z, w). */
export function quatSet(
  dst: Quat,
  x: number,
  y: number,
  z: number,
  w: number
): void {
  dst[0] = x
  dst[1] = y
  dst[2] = z
  dst[3] = w
}

/**
 * Quaternion multiplication: dst = a * b.
 * Safe when dst aliases a or b.
 */
export function quatMultiply(dst: Quat, a: Quat, b: Quat): void {
  const ax = a[0],
    ay = a[1],
    az = a[2],
    aw = a[3]
  const bx = b[0],
    by = b[1],
    bz = b[2],
    bw = b[3]
  dst[0] = aw * bx + ax * bw + ay * bz - az * by
  dst[1] = aw * by - ax * bz + ay * bw + az * bx
  dst[2] = aw * bz + ax * by - ay * bx + az * bw
  dst[3] = aw * bw - ax * bx - ay * by - az * bz
}

/** Normalize quaternion in place. No-op if near zero. */
export function quatNormalize(q: Quat): void {
  const lenSq = q[0] * q[0] + q[1] * q[1] + q[2] * q[2] + q[3] * q[3]
  if (lenSq > 0) {
    const inv = 1 / Math.sqrt(lenSq)
    q[0] *= inv
    q[1] *= inv
    q[2] *= inv
    q[3] *= inv
  }
}

/**
 * Build quaternion from axis-angle.
 * Axis must be a unit vector. Writes into dst.
 */
export function quatFromAxisAngle(dst: Quat, axis: Vec3, angle: number): void {
  const half = angle * 0.5
  const s = Math.sin(half)
  dst[0] = axis[0] * s
  dst[1] = axis[1] * s
  dst[2] = axis[2] * s
  dst[3] = Math.cos(half)
}

/**
 * Build quaternion from yaw (Y), pitch (X), roll (Z) Euler angles in radians.
 * Convention matches BabylonJS RotationYawPitchRoll.
 */
export function quatFromYawPitchRoll(
  dst: Quat,
  yaw: number,
  pitch: number,
  roll: number
): void {
  const hy = yaw * 0.5
  const hp = pitch * 0.5
  const hr = roll * 0.5
  const sy = Math.sin(hy),
    cy = Math.cos(hy)
  const sp = Math.sin(hp),
    cp = Math.cos(hp)
  const sr = Math.sin(hr),
    cr = Math.cos(hr)
  dst[0] = cy * sp * cr + sy * cp * sr
  dst[1] = sy * cp * cr - cy * sp * sr
  dst[2] = cy * cp * sr - sy * sp * cr
  dst[3] = cy * cp * cr + sy * sp * sr
}

/**
 * Extract unit-sphere position from orientation quaternion.
 * Rotates local up (0,1,0) by q. Zero allocations.
 */
export function quatToUnitPoint(dst: Vec3, q: Quat): void {
  const qx = q[0],
    qy = q[1],
    qz = q[2],
    qw = q[3]
  dst[0] = 2 * (qx * qy - qz * qw)
  dst[1] = 1 - 2 * (qx * qx + qz * qz)
  dst[2] = 2 * (qy * qz + qx * qw)
}

/**
 * Build an orientation quaternion from a unit-sphere point.
 * Aligns local +Y with the point and local +Z with a stable tangent (east).
 * Scalar rewrite of unitPointToQuaternion — zero BabylonJS allocations.
 */
export function quatFromUnitPoint(
  dst: Quat,
  x: number,
  y: number,
  z: number
): void {
  // Normalize input
  let lenSq = x * x + y * y + z * z
  if (lenSq < 1e-7) {
    // Zero-length → identity
    dst[0] = 0
    dst[1] = 0
    dst[2] = 0
    dst[3] = 1
    return
  }
  if (Math.abs(lenSq - 1) > 1e-7) {
    const inv = 1 / Math.sqrt(lenSq)
    x *= inv
    y *= inv
    z *= inv
  }

  // East seed: cross(position, up) → (-z, 0, x), then normalize
  let ex = -z,
    ey = 0,
    ez = x
  lenSq = ex * ex + ez * ez
  if (lenSq < 1e-7) {
    // At poles, fall back to (0, 0, 1)
    ex = 0
    ey = 0
    ez = 1
  } else {
    const inv = 1 / Math.sqrt(lenSq)
    ex *= inv
    ez *= inv
  }

  // Step 1: Rotate up (0,1,0) to align with position.
  // axis = cross(up, position) = (z, 0, -x)
  let ax = z,
    ay = 0,
    az = -x
  const axisLen = Math.sqrt(ax * ax + az * az)

  let uqx: number, uqy: number, uqz: number, uqw: number
  if (axisLen < 1e-5) {
    // Position is along ±Y
    if (y > 0) {
      // Already aligned with up → identity
      uqx = 0
      uqy = 0
      uqz = 0
      uqw = 1
    } else {
      // Opposite → 180° around X
      uqx = 1
      uqy = 0
      uqz = 0
      uqw = 0
    }
  } else {
    const invLen = 1 / axisLen
    ax *= invLen
    az *= invLen
    const dot = y // dot(up, position) = position.y
    const angle = Math.acos(Math.max(-1, Math.min(1, dot)))
    const halfAngle = angle * 0.5
    const s = Math.sin(halfAngle)
    uqx = ax * s
    uqy = ay * s
    uqz = az * s
    uqw = Math.cos(halfAngle)
  }

  // Step 2: Compute forward after up-alignment.
  // Rotate local forward (0, 0, 1) by upAligned quaternion using q*v*q⁻¹.
  // t = 2 * cross(q_xyz, v) where v = (0, 0, 1)
  const ftx = 2 * (uqy * 1 - uqz * 0)
  const fty = 2 * (uqz * 0 - uqx * 1)
  const ftz = 2 * (uqx * 0 - uqy * 0)
  // result = v + qw * t + cross(q_xyz, t)
  let fx = 0 + uqw * ftx + (uqy * ftz - uqz * fty)
  let fy = 0 + uqw * fty + (uqz * ftx - uqx * ftz)
  let fz = 1 + uqw * ftz + (uqx * fty - uqy * ftx)

  // Normalize forward
  const fLen = Math.sqrt(fx * fx + fy * fy + fz * fz)
  if (fLen > 1e-7) {
    const fInv = 1 / fLen
    fx *= fInv
    fy *= fInv
    fz *= fInv
  }

  // Step 3: Compute twist angle to align forward with east.
  // cross(forward, east)
  const cx = fy * ez - fz * ey
  const cy = fz * ex - fx * ez
  const cz = fx * ey - fy * ex
  // signedSin = dot(position, cross(forward, east))
  const signedSin = x * cx + y * cy + z * cz
  // signedCos = dot(forward, east)
  const signedCos = fx * ex + fy * ey + fz * ez
  const twist = Math.atan2(signedSin, signedCos)

  // Step 4: Build twist quaternion around position axis.
  const halfTwist = twist * 0.5
  const ts = Math.sin(halfTwist)
  const tqx = x * ts
  const tqy = y * ts
  const tqz = z * ts
  const tqw = Math.cos(halfTwist)

  // Step 5: result = twist * upAligned, then normalize.
  dst[0] = tqw * uqx + tqx * uqw + tqy * uqz - tqz * uqy
  dst[1] = tqw * uqy - tqx * uqz + tqy * uqw + tqz * uqx
  dst[2] = tqw * uqz + tqx * uqy - tqy * uqx + tqz * uqw
  dst[3] = tqw * uqw - tqx * uqx - tqy * uqy - tqz * uqz

  // Normalize result
  const rLenSq =
    dst[0] * dst[0] + dst[1] * dst[1] + dst[2] * dst[2] + dst[3] * dst[3]
  if (rLenSq > 0) {
    const rInv = 1 / Math.sqrt(rLenSq)
    dst[0] *= rInv
    dst[1] *= rInv
    dst[2] *= rInv
    dst[3] *= rInv
  }
}
