import { describe, expect, test } from 'vitest'

import { calculateScore } from '../../src/scoring/calculateScore.js'

describe('calculateScore', () => {
  const defaultOutcomeScores = {
    win: 1,
    loss: 0.1,
    draw: 1 / 3,
  }

  const defaultConfidenceConfig = {
    min: 0.5,
    max: 1.5,
  }

  const defaultMoveWeighting = {
    strategy: 'recency-weighted' as const,
    divisor: 3,
  }

  describe('game outcomes', () => {
    test('should return win score for a win with no moves', () => {
      const result = calculateScore(
        true,
        false,
        [],
        defaultOutcomeScores,
        defaultConfidenceConfig,
        defaultMoveWeighting
      )
      expect(result).toBe(1)
    })

    test('should return loss score for a loss with no moves', () => {
      const result = calculateScore(
        false,
        true,
        [],
        defaultOutcomeScores,
        defaultConfidenceConfig,
        defaultMoveWeighting
      )
      expect(result).toBe(0.1)
    })

    test('should return draw score for a draw with no moves', () => {
      const result = calculateScore(
        false,
        false,
        [],
        defaultOutcomeScores,
        defaultConfidenceConfig,
        defaultMoveWeighting
      )
      expect(result).toBeCloseTo(1 / 3, 10)
    })
  })

  describe('confidence multiplier', () => {
    test('should apply max multiplier for perfect confidence', () => {
      const moveScores = [1.0, 1.0, 1.0] // Perfect confidence
      const result = calculateScore(
        true,
        false,
        moveScores,
        defaultOutcomeScores,
        defaultConfidenceConfig,
        defaultMoveWeighting
      )

      // Win score (1) * max multiplier (1.5) = 1.5
      expect(result).toBe(1.5)
    })

    test('should apply min multiplier for zero confidence', () => {
      const moveScores = [0.0, 0.0, 0.0] // No confidence
      const result = calculateScore(
        true,
        false,
        moveScores,
        defaultOutcomeScores,
        defaultConfidenceConfig,
        defaultMoveWeighting
      )

      // Win score (1) * min multiplier (0.5) = 0.5
      expect(result).toBe(0.5)
    })

    test('should apply mid multiplier for average confidence', () => {
      const moveScores = [0.5, 0.5, 0.5] // Average confidence
      const result = calculateScore(
        true,
        false,
        moveScores,
        defaultOutcomeScores,
        defaultConfidenceConfig,
        defaultMoveWeighting
      )

      // Win score (1) * mid multiplier (1.0) = 1.0
      // multiplier = 0.5 + (1.5 - 0.5) * 0.5 = 1.0
      expect(result).toBe(1.0)
    })
  })

  describe('outcome and confidence combination', () => {
    test('should combine loss outcome with low confidence', () => {
      const moveScores = [0.2, 0.3, 0.1]
      const result = calculateScore(
        false,
        true,
        moveScores,
        defaultOutcomeScores,
        defaultConfidenceConfig,
        defaultMoveWeighting
      )

      // Loss base (0.1) with low confidence (< 0.5 multiplier)
      expect(result).toBeLessThan(0.1)
      expect(result).toBeGreaterThan(0)
    })

    test('should combine draw outcome with high confidence', () => {
      const moveScores = [0.8, 0.9, 1.0]
      const result = calculateScore(
        false,
        false,
        moveScores,
        defaultOutcomeScores,
        defaultConfidenceConfig,
        defaultMoveWeighting
      )

      // Draw base (1/3) with high confidence (> 1.0 multiplier)
      expect(result).toBeGreaterThan(1 / 3)
      expect(result).toBeLessThan(0.5) // Should still be < max of 1.5 * (1/3)
    })
  })

  describe('move weighting integration', () => {
    test('should weight earlier moves more heavily', () => {
      const earlyGoodMoves = [1.0, 1.0, 0.0, 0.0, 0.0, 0.0]
      const lateGoodMoves = [0.0, 0.0, 0.0, 0.0, 1.0, 1.0]

      const earlyScore = calculateScore(
        true,
        false,
        earlyGoodMoves,
        defaultOutcomeScores,
        defaultConfidenceConfig,
        defaultMoveWeighting
      )

      const lateScore = calculateScore(
        true,
        false,
        lateGoodMoves,
        defaultOutcomeScores,
        defaultConfidenceConfig,
        defaultMoveWeighting
      )

      // Early good moves should result in higher score
      expect(earlyScore).toBeGreaterThan(lateScore)
    })

    test('should use equal weighting when configured', () => {
      const moveScores = [1.0, 0.0]
      const equalWeighting = { strategy: 'equal' as const }

      const result = calculateScore(
        true,
        false,
        moveScores,
        defaultOutcomeScores,
        defaultConfidenceConfig,
        equalWeighting
      )

      // With equal weighting: average = 0.5
      // Multiplier = 0.5 + (1.5 - 0.5) * 0.5 = 1.0
      // Score = 1.0 * 1.0 = 1.0
      expect(result).toBe(1.0)
    })
  })

  describe('custom configurations', () => {
    test('should respect custom outcome scores', () => {
      const customOutcomes = { win: 3, loss: -1, draw: 0 }
      const moveScores = [1.0]

      const result = calculateScore(
        true,
        false,
        moveScores,
        customOutcomes,
        defaultConfidenceConfig,
        defaultMoveWeighting
      )

      // Win (3) * max multiplier (1.5) = 4.5
      expect(result).toBe(4.5)
    })

    test('should respect custom confidence bounds', () => {
      const customConfidence = { min: 0.1, max: 2.0 }
      const moveScores = [1.0]

      const result = calculateScore(
        true,
        false,
        moveScores,
        defaultOutcomeScores,
        customConfidence,
        defaultMoveWeighting
      )

      // Win (1) * max multiplier (2.0) = 2.0
      expect(result).toBe(2.0)
    })
  })
})
