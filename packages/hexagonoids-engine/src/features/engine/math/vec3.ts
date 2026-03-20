import type { Quat, Vec3 } from './types.js'

/** Copy src into dst. */
export function vec3Copy(dst: Vec3, src: Vec3): void {
  dst[0] = src[0]
  dst[1] = src[1]
  dst[2] = src[2]
}

/** Set dst to (x, y, z). */
export function vec3Set(dst: Vec3, x: number, y: number, z: number): void {
  dst[0] = x
  dst[1] = y
  dst[2] = z
}

/** dst = src * s */
export function vec3Scale(dst: Vec3, src: Vec3, s: number): void {
  dst[0] = src[0] * s
  dst[1] = src[1] * s
  dst[2] = src[2] * s
}

/** v *= s */
export function vec3ScaleInPlace(v: Vec3, s: number): void {
  v[0] *= s
  v[1] *= s
  v[2] *= s
}

/** dst += src */
export function vec3AddInPlace(dst: Vec3, src: Vec3): void {
  dst[0] += src[0]
  dst[1] += src[1]
  dst[2] += src[2]
}

/** Euclidean length. */
export function vec3Length(v: Vec3): number {
  return Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2])
}

/** Squared length (avoids sqrt). */
export function vec3LengthSq(v: Vec3): number {
  return v[0] * v[0] + v[1] * v[1] + v[2] * v[2]
}

/** Normalize in place. No-op if near zero. */
export function vec3Normalize(v: Vec3): void {
  const lenSq = v[0] * v[0] + v[1] * v[1] + v[2] * v[2]
  if (lenSq > 0) {
    const inv = 1 / Math.sqrt(lenSq)
    v[0] *= inv
    v[1] *= inv
    v[2] *= inv
  }
}

/** Dot product. */
export function vec3Dot(a: Vec3, b: Vec3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
}

/** dst = a × b (cross product). Safe when dst aliases a or b. */
export function vec3Cross(dst: Vec3, a: Vec3, b: Vec3): void {
  const ax = a[0],
    ay = a[1],
    az = a[2]
  const bx = b[0],
    by = b[1],
    bz = b[2]
  dst[0] = ay * bz - az * by
  dst[1] = az * bx - ax * bz
  dst[2] = ax * by - ay * bx
}

/** Exact equality. */
export function vec3Equals(a: Vec3, b: Vec3): boolean {
  return a[0] === b[0] && a[1] === b[1] && a[2] === b[2]
}

/**
 * Rotate vector v by quaternion q: dst = q * v * q⁻¹.
 * Safe when dst aliases v.
 */
export function vec3ApplyQuat(dst: Vec3, v: Vec3, q: Quat): void {
  const vx = v[0],
    vy = v[1],
    vz = v[2]
  const qx = q[0],
    qy = q[1],
    qz = q[2],
    qw = q[3]

  // t = 2 * (q_xyz × v)
  const tx = 2 * (qy * vz - qz * vy)
  const ty = 2 * (qz * vx - qx * vz)
  const tz = 2 * (qx * vy - qy * vx)

  // result = v + qw * t + (q_xyz × t)
  dst[0] = vx + qw * tx + (qy * tz - qz * ty)
  dst[1] = vy + qw * ty + (qz * tx - qx * tz)
  dst[2] = vz + qw * tz + (qx * ty - qy * tx)
}
