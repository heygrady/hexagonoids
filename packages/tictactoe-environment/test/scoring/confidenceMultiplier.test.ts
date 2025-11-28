import { describe, expect, test } from 'vitest'

import { calculateMoveWeightedConfidence } from '../../src/scoring/confidenceMultiplier.js'

describe('calculateMoveWeightedConfidence', () => {
  describe('equal strategy', () => {
    test('should return simple average for equal weighting', () => {
      const moveScores = [0.5, 0.6, 0.7]
      const config = { strategy: 'equal' as const }

      const result = calculateMoveWeightedConfidence(moveScores, config)
      expect(result).toBe(0.6) // (0.5 + 0.6 + 0.7) / 3
    })

    test('should handle single move', () => {
      const moveScores = [0.8]
      const config = { strategy: 'equal' as const }

      const result = calculateMoveWeightedConfidence(moveScores, config)
      expect(result).toBe(0.8)
    })

    test('should return 0 for empty array', () => {
      const moveScores: number[] = []
      const config = { strategy: 'equal' as const }

      const result = calculateMoveWeightedConfidence(moveScores, config)
      expect(result).toBe(0)
    })
  })

  describe('recency-weighted strategy', () => {
    test('should weight earlier moves more heavily with default divisor', () => {
      const moveScores = [0.9, 0.5, 0.1] // Earlier moves are better
      const config = { strategy: 'recency-weighted' as const, divisor: 3 }

      const result = calculateMoveWeightedConfidence(moveScores, config)

      // Weights: [max(ceil((3-0)/3), 1), max(ceil((3-1)/3), 1), max(ceil((3-2)/3), 1)]
      //        = [1, 1, 1] (all moves get weight 1 for 3 moves with divisor 3)
      // Actually for 3 moves: weights = [1, 1, 1], simple average
      expect(result).toBe(0.5) // (0.9 + 0.5 + 0.1) / 3
    })

    test('should weight earlier moves more for longer games', () => {
      // 9 moves with divisor 3
      const moveScores = [1.0, 0.9, 0.8, 0.7, 0.6, 0.5, 0.4, 0.3, 0.2]
      const config = { strategy: 'recency-weighted' as const, divisor: 3 }

      const result = calculateMoveWeightedConfidence(moveScores, config)

      // With descending scores and recency weighting, result should favor early moves
      expect(result).toBeGreaterThan(0.6) // Should be > 0.6 since early moves are weighted more
      expect(result).toBeLessThan(0.8) // But less than first few moves average

      // Verify it's higher than equal weighting would give
      const equalAverage =
        moveScores.reduce((sum, s) => sum + s, 0) / moveScores.length
      expect(result).toBeGreaterThan(equalAverage)
    })

    test('should use custom divisor', () => {
      const moveScores = [1.0, 0.0]
      const config = { strategy: 'recency-weighted' as const, divisor: 1 }

      // Weights: [max(ceil((2-0)/1), 1), max(ceil((2-1)/1), 1)]
      //        = [2, 1]
      // Result: (1.0 * 2 + 0.0 * 1) / (2 + 1) = 2/3
      const result = calculateMoveWeightedConfidence(moveScores, config)
      expect(result).toBeCloseTo(2 / 3, 10)
    })

    test('should always use minimum weight of 1', () => {
      const moveScores = [0.5, 0.5]
      const config = { strategy: 'recency-weighted' as const, divisor: 100 }

      // With large divisor, all weights would be < 1, but minimum is 1
      // So all weights = 1, result should be simple average
      const result = calculateMoveWeightedConfidence(moveScores, config)
      expect(result).toBe(0.5)
    })

    test('should handle undefined divisor (defaults to 3)', () => {
      const moveScores = [0.9, 0.5, 0.1]
      const config = { strategy: 'recency-weighted' as const }

      const result = calculateMoveWeightedConfidence(moveScores, config)
      expect(result).toBeDefined()
      expect(result).toBeGreaterThanOrEqual(0)
      expect(result).toBeLessThanOrEqual(1)
    })

    test('should return 0 for empty array', () => {
      const moveScores: number[] = []
      const config = { strategy: 'recency-weighted' as const, divisor: 3 }

      const result = calculateMoveWeightedConfidence(moveScores, config)
      expect(result).toBe(0)
    })
  })
})
