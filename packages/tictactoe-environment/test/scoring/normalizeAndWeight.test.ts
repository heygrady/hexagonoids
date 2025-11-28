import { describe, expect, test } from 'vitest'

import { normalizeAndWeight } from '../../src/scoring/normalizeAndWeight.js'

describe('normalizeAndWeight', () => {
  test('should normalize a score in the middle of the range (simple bounds)', () => {
    const rawScore = 0.5
    const bounds = { min: 0, max: 1 }
    const weight = 1

    const result = normalizeAndWeight(rawScore, bounds, weight, true)
    expect(result).toBe(0.5)
  })

  test('should normalize a score at the minimum (simple bounds)', () => {
    const rawScore = 0.05
    const bounds = { min: 0.05, max: 1.5 }
    const weight = 1

    const result = normalizeAndWeight(rawScore, bounds, weight, true)
    expect(result).toBe(0)
  })

  test('should normalize a score at the maximum (simple bounds)', () => {
    const rawScore = 1.5
    const bounds = { min: 0.05, max: 1.5 }
    const weight = 1

    const result = normalizeAndWeight(rawScore, bounds, weight, true)
    expect(result).toBe(1)
  })

  test('should apply weight correctly (simple bounds)', () => {
    const rawScore = 1
    const bounds = { min: 0, max: 1 }
    const weight = 0.4

    const result = normalizeAndWeight(rawScore, bounds, weight, true)
    expect(result).toBe(0.4)
  })

  test('should handle scores outside bounds (soft normalization)', () => {
    // Scores can exceed bounds
    const rawScore = 2
    const bounds = { min: 0, max: 1 }
    const weight = 1

    const result = normalizeAndWeight(rawScore, bounds, weight, true)
    expect(result).toBe(2) // (2 - 0) / (1 - 0) * 1 = 2
  })

  test('should combine normalization and weighting (simple bounds)', () => {
    const rawScore = 0.8
    const bounds = { min: 0.05, max: 1.5 }
    const weight = 0.6

    // normalized = (0.8 - 0.05) / (1.5 - 0.05) = 0.75 / 1.45 ≈ 0.517
    // weighted = 0.517 * 0.6 ≈ 0.310
    const result = normalizeAndWeight(rawScore, bounds, weight, true)
    expect(result).toBeCloseTo(0.31, 2)
  })

  test('should handle negative bounds (simple bounds)', () => {
    const rawScore = 0
    const bounds = { min: -1, max: 1 }
    const weight = 1

    const result = normalizeAndWeight(rawScore, bounds, weight, true)
    expect(result).toBe(0.5)
  })

  test('should use first player bounds from tuple', () => {
    const rawScore = 0.5
    const bounds = { min: [0, 0.1], max: [1, 1.1] } // Different bounds per position
    const weight = 1

    // Should use first bounds: min=0, max=1
    const result = normalizeAndWeight(rawScore, bounds, weight, true)
    expect(result).toBe(0.5) // (0.5 - 0) / (1 - 0) * 1 = 0.5
  })

  test('should use second player bounds from tuple', () => {
    const rawScore = 0.6
    const bounds = { min: [0, 0.1], max: [1, 1.1] } // Different bounds per position
    const weight = 1

    // Should use second bounds: min=0.1, max=1.1
    const result = normalizeAndWeight(rawScore, bounds, weight, false)
    expect(result).toBe(0.5) // (0.6 - 0.1) / (1.1 - 0.1) * 1 = 0.5
  })

  test('should handle mixed simple/tuple bounds', () => {
    const rawScore = 0.5
    const bounds = { min: 0, max: [1, 2] } // min is simple, max is tuple
    const weight = 1

    // First player: min=0, max=1
    const result1 = normalizeAndWeight(rawScore, bounds, weight, true)
    expect(result1).toBe(0.5)

    // Second player: min=0, max=2
    const result2 = normalizeAndWeight(rawScore, bounds, weight, false)
    expect(result2).toBe(0.25) // (0.5 - 0) / (2 - 0) * 1 = 0.25
  })
})
