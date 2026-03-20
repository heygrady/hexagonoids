/**
 * 3-element Float64Array representing a vector: [x, y, z].
 *
 * Explicit numeric properties override the index signature so that
 * v[0], v[1], v[2] return `number` (not `number | undefined`) even
 * with noUncheckedIndexedAccess enabled. Length is readonly.
 */
export type Vec3 = Float64Array & {
  0: number
  1: number
  2: number
  readonly length: 3
}

/**
 * 4-element Float64Array representing a quaternion: [x, y, z, w].
 *
 * Explicit numeric properties override the index signature so that
 * q[0]..q[3] return `number` (not `number | undefined`) even
 * with noUncheckedIndexedAccess enabled. Length is readonly.
 */
export type Quat = Float64Array & {
  0: number
  1: number
  2: number
  3: number
  readonly length: 4
}
