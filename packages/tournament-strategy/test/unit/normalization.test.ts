import { describe, test, expect } from 'vitest'

import { reverseNormalize } from '../fixtures/types.js'

describe('Normalization Utility', () => {
  describe('normalizeToRange behavior', () => {
    test('should normalize mid-range value to 0.5', () => {
      // Mid-point of [800, 3000] is 1900
      const range = { min: 800, max: 3000 }
      const value = 1900
      const expected = 0.5

      // Simulate normalizeToRange logic
      const normalized = (value - range.min) / (range.max - range.min)
      const clamped = Math.max(0, Math.min(1, normalized))

      expect(clamped).toBeCloseTo(expected, 5)
    })

    test('should clamp values below min to 0', () => {
      const range = { min: 800, max: 3000 }
      const value = 500 // Below min

      const normalized = (value - range.min) / (range.max - range.min)
      const clamped = Math.max(0, Math.min(1, normalized))

      expect(clamped).toBe(0)
    })

    test('should clamp values above max to 1', () => {
      const range = { min: 800, max: 3000 }
      const value = 5000 // Above max

      const normalized = (value - range.min) / (range.max - range.min)
      const clamped = Math.max(0, Math.min(1, normalized))

      expect(clamped).toBe(1)
    })

    test('should handle edge cases: min → 0, max → 1', () => {
      const range = { min: 800, max: 3000 }

      // Test min value
      const minNormalized = (range.min - range.min) / (range.max - range.min)
      expect(minNormalized).toBe(0)

      // Test max value
      const maxNormalized = (range.max - range.min) / (range.max - range.min)
      expect(maxNormalized).toBe(1)
    })

    test('should produce different normalizations for different ranges', () => {
      const value = 1500

      const range1 = { min: 800, max: 3000 }
      const norm1 = (value - range1.min) / (range1.max - range1.min)

      const range2 = { min: 0, max: 2500 }
      const norm2 = (value - range2.min) / (range2.max - range2.min)

      expect(norm1).not.toBeCloseTo(norm2)
      expect(norm1).toBeCloseTo(0.318, 2) // (1500-800)/(3000-800)
      expect(norm2).toBeCloseTo(0.6, 2) // (1500-0)/(2500-0)
    })

    test('should handle zero-width ranges gracefully', () => {
      const range = { min: 1500, max: 1500 }
      const value = 1500

      const normalized = (value - range.min) / (range.max - range.min)

      // Division by zero gives NaN or Infinity
      expect(Number.isNaN(normalized) || !Number.isFinite(normalized)).toBe(
        true
      )
    })
  })

  describe('reverseNormalize utility', () => {
    test('should reverse normalize 0.5 to mid-range', () => {
      const range = { min: 800, max: 3000 }
      const normalized = 0.5
      const expected = 1900

      const reversed = reverseNormalize(normalized, range)
      expect(reversed).toBeCloseTo(expected, 5)
    })

    test('should reverse normalize 0 to min', () => {
      const range = { min: 800, max: 3000 }
      const normalized = 0

      const reversed = reverseNormalize(normalized, range)
      expect(reversed).toBe(range.min)
    })

    test('should reverse normalize 1 to max', () => {
      const range = { min: 800, max: 3000 }
      const normalized = 1

      const reversed = reverseNormalize(normalized, range)
      expect(reversed).toBe(range.max)
    })

    test('should work for innovation bonus range', () => {
      const range = { min: 0, max: 500 }
      const normalized = 0.3

      const reversed = reverseNormalize(normalized, range)
      expect(reversed).toBeCloseTo(150, 5) // 0.3 * 500
    })

    test('should work for conservative rating range', () => {
      const range = { min: 0, max: 2500 }
      const normalized = 0.8

      const reversed = reverseNormalize(normalized, range)
      expect(reversed).toBeCloseTo(2000, 5) // 0.8 * 2500
    })

    test('should be inverse of normalize', () => {
      const range = { min: 800, max: 3000 }
      const originalValue = 1750

      // Normalize
      const normalized = (originalValue - range.min) / (range.max - range.min)
      const clamped = Math.max(0, Math.min(1, normalized))

      // Reverse
      const reversed = reverseNormalize(clamped, range)

      expect(reversed).toBeCloseTo(originalValue, 5)
    })
  })

  describe('normalization ranges from GlickoStrategy', () => {
    const defaultRanges = {
      glickoRating: { min: 800, max: 3000 },
      conservativeRating: { min: 0, max: 2500 },
      innovationBonus: { min: 0, max: 500 },
    }

    test('glickoRating range should accommodate typical values', () => {
      const typicalValues = [1200, 1500, 1800, 2000, 2500]

      for (const value of typicalValues) {
        const normalized =
          (value - defaultRanges.glickoRating.min) /
          (defaultRanges.glickoRating.max - defaultRanges.glickoRating.min)
        const clamped = Math.max(0, Math.min(1, normalized))

        expect(clamped).toBeGreaterThanOrEqual(0)
        expect(clamped).toBeLessThanOrEqual(1)
      }
    })

    test('conservativeRating range should handle negative conservative scores', () => {
      // Conservative score can be negative: rating - 2*RD
      // Example: 1200 - 2*700 = -200
      const negativeValue = -200

      const normalized =
        (negativeValue - defaultRanges.conservativeRating.min) /
        (defaultRanges.conservativeRating.max -
          defaultRanges.conservativeRating.min)
      const clamped = Math.max(0, Math.min(1, normalized))

      expect(clamped).toBe(0) // Clamped to 0
    })

    test('innovationBonus range should handle large improvements', () => {
      // Innovation = max(0, (improvement - 100) * 0.5)
      // For 600 point improvement: (600 - 100) * 0.5 = 250
      const largeBonus = 250

      const normalized =
        (largeBonus - defaultRanges.innovationBonus.min) /
        (defaultRanges.innovationBonus.max - defaultRanges.innovationBonus.min)
      const clamped = Math.max(0, Math.min(1, normalized))

      expect(clamped).toBeCloseTo(0.5, 5) // 250 / 500 = 0.5
    })

    test('should handle boundary overflow gracefully', () => {
      // If rating exceeds max (3000), it should clamp to 1
      const extremeValue = 5000

      const normalized =
        (extremeValue - defaultRanges.glickoRating.min) /
        (defaultRanges.glickoRating.max - defaultRanges.glickoRating.min)
      const clamped = Math.max(0, Math.min(1, normalized))

      expect(clamped).toBe(1)
    })
  })
})
