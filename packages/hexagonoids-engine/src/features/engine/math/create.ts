import type { Quat, Vec3 } from './types.js'

export function vec3(x: number, y: number, z: number): Vec3 {
  const v = new Float64Array(3) as Vec3
  v[0] = x
  v[1] = y
  v[2] = z
  return v
}

export function vec3Zero(): Vec3 {
  return new Float64Array(3) as Vec3
}

export function quat(x: number, y: number, z: number, w: number): Quat {
  const q = new Float64Array(4) as Quat
  q[0] = x
  q[1] = y
  q[2] = z
  q[3] = w
  return q
}

export function quatIdentity(): Quat {
  const q = new Float64Array(4) as Quat
  q[3] = 1
  return q
}
