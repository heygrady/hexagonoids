import { describe, expect, it } from 'vitest'
import {
  allNecklaceClasses,
  canonicalNecklace,
  coneOccupancyMask,
  hammingDistance,
  popcount8,
} from '../../src/encoding/coneOccupancy.js'
import {
  CONE_COUNT,
  FEATURES_PER_CONE,
  GLOBAL_FEATURES,
  INPUT_COUNT,
} from '../../src/encoding/encodingPresets.js'

describe('popcount8', () => {
  it('returns 0 for empty mask', () => {
    expect(popcount8(0)).toBe(0)
  })

  it('returns 8 for full mask', () => {
    expect(popcount8(0xff)).toBe(8)
  })

  it('counts bits correctly', () => {
    expect(popcount8(0b10101010)).toBe(4)
    expect(popcount8(0b00000001)).toBe(1)
    expect(popcount8(0b01010101)).toBe(4)
    expect(popcount8(0b11110000)).toBe(4)
    expect(popcount8(0b00110011)).toBe(4)
  })
})

describe('canonicalNecklace', () => {
  it('returns 0 for empty pattern', () => {
    expect(canonicalNecklace(0)).toBe(0)
  })

  it('returns 0xFF for full pattern', () => {
    expect(canonicalNecklace(0xff)).toBe(0xff)
  })

  it('maps all single-bit patterns to the same canonical', () => {
    const results = new Set<number>()
    for (let i = 0; i < 8; i++) {
      results.add(canonicalNecklace(1 << i))
    }
    expect(results.size).toBe(1)
    expect(results.has(1)).toBe(true) // 0b00000001 is the minimum rotation
  })

  it('maps rotations to the same canonical', () => {
    // 0b00000011 (adjacent pair) and its rotations
    const base = 0b00000011
    const rotations = [
      0b00000011, 0b00000110, 0b00001100, 0b00011000, 0b00110000, 0b01100000,
      0b11000000, 0b10000001,
    ]
    const canonical = canonicalNecklace(base)
    for (const r of rotations) {
      expect(canonicalNecklace(r)).toBe(canonical)
    }
  })

  it('distinguishes non-rotationally-equivalent patterns', () => {
    // Adjacent pair vs opposite pair
    const adjacent = canonicalNecklace(0b00000011)
    const opposite = canonicalNecklace(0b00010001)
    expect(adjacent).not.toBe(opposite)
  })
})

describe('allNecklaceClasses', () => {
  it('returns exactly 36 classes', () => {
    const classes = allNecklaceClasses()
    expect(classes).toHaveLength(36)
  })

  it('covers all 256 patterns', () => {
    const classes = new Set(allNecklaceClasses())
    for (let mask = 0; mask < 256; mask++) {
      expect(classes.has(canonicalNecklace(mask))).toBe(true)
    }
  })

  it('returns sorted values', () => {
    const classes = allNecklaceClasses()
    for (let i = 1; i < classes.length; i++) {
      expect(classes[i]!).toBeGreaterThan(classes[i - 1]!)
    }
  })

  it('includes 0 and 0xFF', () => {
    const classes = allNecklaceClasses()
    expect(classes).toContain(0)
    expect(classes).toContain(0xff)
  })
})

describe('hammingDistance', () => {
  it('returns 0 for identical masks', () => {
    expect(hammingDistance(0b10101010, 0b10101010)).toBe(0)
  })

  it('returns 1 for single bit flip', () => {
    expect(hammingDistance(0b00000000, 0b00000001)).toBe(1)
  })

  it('returns 8 for maximum distance', () => {
    expect(hammingDistance(0x00, 0xff)).toBe(8)
  })

  it('is symmetric', () => {
    expect(hammingDistance(0b11001100, 0b10101010)).toBe(
      hammingDistance(0b10101010, 0b11001100)
    )
  })
})

describe('coneOccupancyMask', () => {
  function makeInputs(coneProximities: number[]): number[] {
    const inputs = new Array<number>(INPUT_COUNT).fill(-1.0)
    for (let cone = 0; cone < CONE_COUNT; cone++) {
      const base = GLOBAL_FEATURES + cone * FEATURES_PER_CONE
      inputs[base] = coneProximities[cone] ?? -1.0
    }
    return inputs
  }

  it('returns 0 for all-empty cones (default proximity = 0)', () => {
    const inputs = makeInputs([0, 0, 0, 0, 0, 0, 0, 0])
    expect(coneOccupancyMask(inputs)).toBe(0)
  })

  it('returns 0xFF for all-occupied cones (positive proximity)', () => {
    const inputs = makeInputs([0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5])
    expect(coneOccupancyMask(inputs)).toBe(0xff)
  })

  it('detects occupied cones with negative proximity (beyond bullet range)', () => {
    const inputs = makeInputs([-0.5, 0, 0, 0, -0.3, 0, 0, 0])
    expect(coneOccupancyMask(inputs)).toBe(0b00010001) // cones 0 and 4
  })

  it('sets correct bit for single occupied cone', () => {
    for (let cone = 0; cone < 8; cone++) {
      const proximities = [0, 0, 0, 0, 0, 0, 0, 0]
      proximities[cone] = 0.3
      const inputs = makeInputs(proximities)
      expect(coneOccupancyMask(inputs)).toBe(1 << cone)
    }
  })

  it('treats exactly 0 as empty', () => {
    const inputs = makeInputs([0, -0.5, 0, 0, 0, 0, 0, 0])
    expect(coneOccupancyMask(inputs)).toBe(0b00000010) // cone 1 occupied
  })
})
