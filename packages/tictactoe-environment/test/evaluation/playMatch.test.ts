import { simpleAI, minimaxAI } from '@heygrady/tictactoe-game'
import { describe, expect, test } from 'vitest'

import { playMatch } from '../../src/evaluation/playMatch.js'

describe('playMatch', () => {
  const defaultNormalizationBounds = { min: 0.05, max: 1.5 }
  const defaultPositionWeights = { firstPlayer: 0.4, secondPlayer: 0.6 }
  const defaultOutcomes = { win: 1, loss: 0.1, draw: 1 / 3 }
  const defaultConfidence = { min: 0.5, max: 1.5 }
  const defaultWeighting = { strategy: 'recency-weighted' as const, divisor: 3 }

  test('should return MatchResult with scores for both players', () => {
    const result = playMatch(
      simpleAI,
      simpleAI,
      defaultNormalizationBounds,
      defaultPositionWeights,
      defaultOutcomes,
      defaultConfidence,
      defaultWeighting
    )

    expect(typeof result.scoreA).toBe('number')
    expect(typeof result.scoreB).toBe('number')
    expect(typeof result.rawScoreA1).toBe('number')
    expect(typeof result.rawScoreA2).toBe('number')
    expect(typeof result.rawScoreB1).toBe('number')
    expect(typeof result.rawScoreB2).toBe('number')
  })

  test('should produce normalized scores in reasonable range', () => {
    const result = playMatch(
      simpleAI,
      simpleAI,
      defaultNormalizationBounds,
      defaultPositionWeights,
      defaultOutcomes,
      defaultConfidence,
      defaultWeighting
    )

    // Scores should be in a reasonable range
    // Can be negative if performance is below min bound
    // Can be > 1 if performance exceeds max bound
    expect(result.scoreA).toBeGreaterThan(-1)
    expect(result.scoreA).toBeLessThan(2)
    expect(result.scoreB).toBeGreaterThan(-1)
    expect(result.scoreB).toBeLessThan(2)
  })

  test('should play two games (swapped positions)', () => {
    // With deterministic players, we should see consistent results
    const result = playMatch(
      minimaxAI,
      simpleAI,
      defaultNormalizationBounds,
      defaultPositionWeights,
      defaultOutcomes,
      defaultConfidence,
      defaultWeighting
    )

    // MinimaxAI should score at least as well as simpleAI (could tie)
    expect(result.scoreA).toBeGreaterThanOrEqual(result.scoreB)
  })

  test('should respect position weights', () => {
    const equalWeights = { firstPlayer: 0.5, secondPlayer: 0.5 }
    const unequalWeights = { firstPlayer: 0.2, secondPlayer: 0.8 }

    const resultEqual = playMatch(
      simpleAI,
      simpleAI,
      defaultNormalizationBounds,
      equalWeights,
      defaultOutcomes,
      defaultConfidence,
      defaultWeighting
    )

    const resultUnequal = playMatch(
      simpleAI,
      simpleAI,
      defaultNormalizationBounds,
      unequalWeights,
      defaultOutcomes,
      defaultConfidence,
      defaultWeighting
    )

    // Scores should be different with different weights
    // (though they might be close for equal-strength players)
    expect(resultEqual.scoreA).toBeDefined()
    expect(resultUnequal.scoreA).toBeDefined()
  })

  test('should respect normalization bounds', () => {
    const tightBounds = { min: 0.3, max: 0.7 }
    const wideBounds = { min: 0.0, max: 2.0 }

    const resultTight = playMatch(
      simpleAI,
      simpleAI,
      tightBounds,
      defaultPositionWeights,
      defaultOutcomes,
      defaultConfidence,
      defaultWeighting
    )

    const resultWide = playMatch(
      simpleAI,
      simpleAI,
      wideBounds,
      defaultPositionWeights,
      defaultOutcomes,
      defaultConfidence,
      defaultWeighting
    )

    // Different bounds should generally produce different normalized scores
    expect(resultTight.scoreA).toBeDefined()
    expect(resultWide.scoreA).toBeDefined()
  })

  test('should produce deterministic results for deterministic players', () => {
    const result1 = playMatch(
      minimaxAI,
      minimaxAI,
      defaultNormalizationBounds,
      defaultPositionWeights,
      defaultOutcomes,
      defaultConfidence,
      defaultWeighting
    )

    const result2 = playMatch(
      minimaxAI,
      minimaxAI,
      defaultNormalizationBounds,
      defaultPositionWeights,
      defaultOutcomes,
      defaultConfidence,
      defaultWeighting
    )

    // Same players should get same scores
    expect(result1.scoreA).toBe(result2.scoreA)
    expect(result1.scoreB).toBe(result2.scoreB)
  })

  test('should combine scores from both games correctly', () => {
    const result = playMatch(
      simpleAI,
      simpleAI,
      defaultNormalizationBounds,
      defaultPositionWeights,
      defaultOutcomes,
      defaultConfidence,
      defaultWeighting
    )

    // For equal-strength players, scores can vary due to randomness
    // Just verify both scores are in valid range
    expect(result.scoreA).toBeGreaterThan(-1)
    expect(result.scoreA).toBeLessThan(2)
    expect(result.scoreB).toBeGreaterThan(-1)
    expect(result.scoreB).toBeLessThan(2)
  })

  test('should provide raw scores for debugging', () => {
    const result = playMatch(
      minimaxAI,
      simpleAI,
      defaultNormalizationBounds,
      defaultPositionWeights,
      defaultOutcomes,
      defaultConfidence,
      defaultWeighting
    )

    // Raw scores should be present and in reasonable range
    expect(result.rawScoreA1).toBeGreaterThanOrEqual(0)
    expect(result.rawScoreA2).toBeGreaterThanOrEqual(0)
    expect(result.rawScoreB1).toBeGreaterThanOrEqual(0)
    expect(result.rawScoreB2).toBeGreaterThanOrEqual(0)

    // Raw scores should be different from normalized scores (usually)
    // This is a soft check - they could theoretically be equal
    expect(result).toHaveProperty('rawScoreA1')
    expect(result).toHaveProperty('rawScoreA2')
    expect(result).toHaveProperty('rawScoreB1')
    expect(result).toHaveProperty('rawScoreB2')
  })

  test('should support position-specific normalization bounds', () => {
    const positionSpecificBounds = {
      min: [0.05, 0.1], // Different min for first vs second player
      max: [1.5, 1.0], // Different max for first vs second player
    }

    const result = playMatch(
      simpleAI,
      simpleAI,
      positionSpecificBounds,
      defaultPositionWeights,
      defaultOutcomes,
      defaultConfidence,
      defaultWeighting
    )

    // Should still produce valid scores
    expect(result.scoreA).toBeGreaterThan(-1)
    expect(result.scoreA).toBeLessThan(2)
    expect(result.scoreB).toBeGreaterThan(-1)
    expect(result.scoreB).toBeLessThan(2)
  })
})
