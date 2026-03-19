import {
  CONE_COUNT,
  FEATURES_PER_CONE,
  GLOBAL_FEATURES,
} from './encodingPresets.js'

/**
 * Extract an 8-bit cone occupancy mask from an encoded input vector.
 * Bit i is set if cone i has a rock (proximity !== 0).
 *
 * Empty cones have the default proximity of 0. Occupied cones have
 * positive proximity (within bullet range) or negative proximity
 * (beyond bullet range but within SOI).
 */
export function coneOccupancyMask(inputs: ArrayLike<number>): number {
  let mask = 0
  for (let cone = 0; cone < CONE_COUNT; cone++) {
    const proximityIndex = GLOBAL_FEATURES + cone * FEATURES_PER_CONE
    if (inputs[proximityIndex]! !== 0) {
      mask |= 1 << cone
    }
  }
  return mask
}

/**
 * Compute the canonical necklace representative for an 8-bit mask.
 * Returns the minimum value among all 8 rotations of the pattern.
 */
export function canonicalNecklace(mask: number): number {
  let min = mask & 0xff
  let rotated = mask & 0xff
  for (let r = 1; r < CONE_COUNT; r++) {
    rotated = ((rotated << 1) | (rotated >> 7)) & 0xff
    if (rotated < min) min = rotated
  }
  return min
}

/**
 * Count set bits in an 8-bit value.
 */
export function popcount8(mask: number): number {
  let n = mask & 0xff
  n = n - ((n >> 1) & 0x55)
  n = (n & 0x33) + ((n >> 2) & 0x33)
  return (n + (n >> 4)) & 0x0f
}

/**
 * Enumerate all 36 canonical necklace representatives for 8-bit patterns.
 */
export function allNecklaceClasses(): number[] {
  const seen = new Set<number>()
  for (let mask = 0; mask < 256; mask++) {
    seen.add(canonicalNecklace(mask))
  }
  return [...seen].sort((a, b) => a - b)
}

/**
 * Hamming distance between two 8-bit masks (number of differing bits).
 */
export function hammingDistance(a: number, b: number): number {
  return popcount8(a ^ b)
}
