import { defaultNEATConfigOptions } from '@neat-evolution/core'
import { createExecutor } from '@neat-evolution/executor'
import {
  createConfig,
  createGenome,
  createPhenotype,
  createState,
  defaultNEATGenomeOptions,
} from '@neat-evolution/neat'
import { describe, expect, test } from 'vitest'

import { createEnvironment } from '../../src/createEnvironment.js'
import {
  calculateNormalizationBounds,
  calculateOpponentNormalizationBounds,
  type ConfidenceMultiplierConfig,
  type GameOutcomeScores,
} from '../../src/types/scoring.js'

describe('Configuration Flow Integration Tests', () => {
  // Helper to create a test executor for Tic-Tac-Toe
  function createTestExecutor() {
    const config = createConfig(defaultNEATConfigOptions)
    const state = createState()
    const genome = createGenome(
      config,
      state,
      defaultNEATGenomeOptions,
      { inputs: 18, outputs: 9 } // Tic-Tac-Toe: 3x3 board (9) * 2 players = 18 inputs, 9 outputs (one per cell)
    )
    const phenotype = createPhenotype(genome)
    return createExecutor(phenotype)
  }

  describe('calculateNormalizationBounds', () => {
    test('should calculate correct bounds with standard configuration', () => {
      const outcomeScores: GameOutcomeScores = {
        win: 1,
        draw: 0.5,
        loss: -0.1,
      }
      const confidenceMultiplier: ConfidenceMultiplierConfig = {
        min: 0.5,
        max: 1.5,
      }

      const bounds = calculateNormalizationBounds(
        outcomeScores,
        confidenceMultiplier
      )

      // Min should be loss * max (more negative value)
      expect(bounds.min).toBe(-0.1 * 1.5) // -0.15
      // Max should be win * max
      expect(bounds.max).toBe(1 * 1.5) // 1.5
    })

    test('should handle edge case where min=max=1', () => {
      const outcomeScores: GameOutcomeScores = {
        win: 1,
        draw: 0.5,
        loss: -0.1,
      }
      const confidenceMultiplier: ConfidenceMultiplierConfig = {
        min: 1,
        max: 1,
      }

      const bounds = calculateNormalizationBounds(
        outcomeScores,
        confidenceMultiplier
      )

      // When confidence multiplier is 1.0 for both min and max
      expect(bounds.min).toBe(-0.1 * 1) // -0.1
      expect(bounds.max).toBe(1 * 1) // 1.0

      // Should be valid, non-empty range
      expect(bounds.max).toBeGreaterThan(bounds.min)
    })

    test('should calculate bounds that expand with increased confidence range', () => {
      const outcomeScores: GameOutcomeScores = {
        win: 1,
        draw: 0.5,
        loss: -0.1,
      }

      const narrow: ConfidenceMultiplierConfig = { min: 0.9, max: 1.1 }
      const wide: ConfidenceMultiplierConfig = { min: 0.5, max: 1.5 }

      const narrowBounds = calculateNormalizationBounds(outcomeScores, narrow)
      const wideBounds = calculateNormalizationBounds(outcomeScores, wide)

      // Wide bounds should have larger range
      expect(wideBounds.max - wideBounds.min).toBeGreaterThan(
        narrowBounds.max - narrowBounds.min
      )
    })
  })

  describe('calculateOpponentNormalizationBounds', () => {
    const outcomeScores: GameOutcomeScores = {
      win: 1,
      draw: 0.5,
      loss: -0.1,
    }
    const confidenceMultiplier: ConfidenceMultiplierConfig = {
      min: 0.5,
      max: 1.5,
    }

    test('should derive minimaxAI bounds correctly', () => {
      const bounds = calculateOpponentNormalizationBounds(
        'minimaxAI',
        outcomeScores,
        confidenceMultiplier
      )

      // Against perfect play: best outcome is draw
      expect(bounds.max).toBe(0.5 * 1.5) // draw * confidence.max = 0.75
      expect(bounds.min).toBe(-0.1 * 1.5) // loss * confidence.max = -0.15
    })

    test('should derive heuristicAI bounds with position-specific max', () => {
      const bounds = calculateOpponentNormalizationBounds(
        'heuristicAI',
        outcomeScores,
        confidenceMultiplier
      )

      // Position-specific max bounds (tuple)
      expect(Array.isArray(bounds.max)).toBe(true)
      const [maxFirst, maxSecond] = bounds.max as [number, number]

      // When heuristic is first: best is draw
      expect(maxFirst).toBe(0.5 * 1.5) // draw * confidence.max = 0.75
      // When heuristic is second: best is win
      expect(maxSecond).toBe(1 * 1.5) // win * confidence.max = 1.5

      // Min should always be the same (worst case)
      expect(bounds.min).toBe(-0.1 * 1.5) // -0.15
    })

    test('should derive simpleAI bounds with full range', () => {
      const bounds = calculateOpponentNormalizationBounds(
        'simpleAI',
        outcomeScores,
        confidenceMultiplier
      )

      // Can win against weak opponent
      expect(bounds.max).toBe(1 * 1.5) // win * confidence.max = 1.5
      expect(bounds.min).toBe(-0.1 * 1.5) // loss * confidence.max = -0.15
      expect(typeof bounds.max).toBe('number') // Not position-specific
    })

    test('should derive randomAI bounds with full range', () => {
      const bounds = calculateOpponentNormalizationBounds(
        'randomAI',
        outcomeScores,
        confidenceMultiplier
      )

      // Can win against random opponent
      expect(bounds.max).toBe(1 * 1.5) // win * confidence.max = 1.5
      expect(bounds.min).toBe(-0.1 * 1.5) // loss * confidence.max = -0.15
      expect(typeof bounds.max).toBe('number') // Not position-specific
    })

    test('should handle different outcome scores', () => {
      const customOutcomeScores: GameOutcomeScores = {
        win: 2,
        draw: 1,
        loss: 0,
      }

      const bounds = calculateOpponentNormalizationBounds(
        'minimaxAI',
        customOutcomeScores,
        confidenceMultiplier
      )

      // Should use custom outcome scores
      expect(bounds.max).toBe(1 * 1.5) // draw * confidence.max = 1.5
      expect(bounds.min).toBe(0 * 1.5) // loss * confidence.max = 0
    })
  })

  describe('Configuration propagation to environment', () => {
    test('should create environment with derived opponent bounds (no normalizationBounds field)', () => {
      const config = {
        gameOutcomeScores: {
          win: 1,
          draw: 0.5,
          loss: -0.1,
        },
        confidenceMultiplier: {
          min: 0.5,
          max: 1.5,
        },
        moveWeighting: { strategy: 'equal' as const },
        positionWeights: {
          firstPlayer: 0.5,
          secondPlayer: 0.5,
        },
        gauntletOpponents: [
          { opponent: 'simpleAI' as const, numGames: 2, weight: 1 },
        ],
      }

      // Should not throw - OpponentConfig no longer requires normalizationBounds
      const environment = createEnvironment(config)
      expect(environment).toBeDefined()
    })

    test('should evaluate with derived opponent bounds', () => {
      const config = {
        gameOutcomeScores: {
          win: 1,
          draw: 0.5,
          loss: -0.1,
        },
        confidenceMultiplier: {
          min: 0.5,
          max: 1.5,
        },
        moveWeighting: { strategy: 'equal' as const },
        positionWeights: {
          firstPlayer: 0.5,
          secondPlayer: 0.5,
        },
        gauntletOpponents: [
          { opponent: 'simpleAI' as const, numGames: 2, weight: 1 },
        ],
      }

      const environment = createEnvironment(config)
      const executor = createTestExecutor()

      // Should not throw - bounds are derived automatically
      const fitness = environment.evaluate(executor)
      expect(fitness).toBeGreaterThanOrEqual(0)
    })

    test('should handle mixed opponent weights', () => {
      const config = {
        gameOutcomeScores: {
          win: 1,
          draw: 0.5,
          loss: -0.1,
        },
        confidenceMultiplier: {
          min: 0.5,
          max: 1.5,
        },
        moveWeighting: { strategy: 'equal' as const },
        positionWeights: {
          firstPlayer: 0.5,
          secondPlayer: 0.5,
        },
        gauntletOpponents: [
          { opponent: 'minimaxAI' as const, numGames: 2, weight: 0.25 },
          { opponent: 'heuristicAI' as const, numGames: 2, weight: 0.25 },
          { opponent: 'simpleAI' as const, numGames: 2, weight: 0.25 },
          { opponent: 'randomAI' as const, numGames: 2, weight: 0.25 },
        ],
      }

      const environment = createEnvironment(config)
      const executor = createTestExecutor()

      // Should apply correct bounds to each opponent type
      const fitness = environment.evaluate(executor)
      expect(fitness).toBeGreaterThanOrEqual(0)
    })
  })

  describe('Configuration edge cases', () => {
    test('should handle confidence multiplier where min=max=1', () => {
      const outcomeScores: GameOutcomeScores = {
        win: 1,
        draw: 0.5,
        loss: -0.1,
      }
      const confidenceMultiplier: ConfidenceMultiplierConfig = {
        min: 1,
        max: 1,
      }

      // Should not throw when calculating bounds
      const generalBounds = calculateNormalizationBounds(
        outcomeScores,
        confidenceMultiplier
      )
      expect(generalBounds).toBeDefined()

      // Opponent-specific bounds should also work
      const minimaxBounds = calculateOpponentNormalizationBounds(
        'minimaxAI',
        outcomeScores,
        confidenceMultiplier
      )
      expect(minimaxBounds).toBeDefined()

      const heuristicBounds = calculateOpponentNormalizationBounds(
        'heuristicAI',
        outcomeScores,
        confidenceMultiplier
      )
      expect(heuristicBounds).toBeDefined()
      expect(Array.isArray(heuristicBounds.max)).toBe(true)
    })

    test('should handle very small confidence multiplier range', () => {
      const outcomeScores: GameOutcomeScores = {
        win: 1,
        draw: 0.5,
        loss: -0.1,
      }
      const confidenceMultiplier: ConfidenceMultiplierConfig = {
        min: 0.99,
        max: 1.01,
      }

      const bounds = calculateNormalizationBounds(
        outcomeScores,
        confidenceMultiplier
      )

      // Range should be very narrow but still valid
      expect(bounds.max).toBeGreaterThan(bounds.min)
    })

    test('should handle very large confidence multiplier', () => {
      const outcomeScores: GameOutcomeScores = {
        win: 1,
        draw: 0.5,
        loss: -0.1,
      }
      const confidenceMultiplier: ConfidenceMultiplierConfig = {
        min: 0.1,
        max: 10.0,
      }

      const bounds = calculateNormalizationBounds(
        outcomeScores,
        confidenceMultiplier
      )

      // Should expand to accommodate large multiplier
      expect(bounds.max).toBe(1 * 10.0) // 10.0
      expect(bounds.min).toBe(-0.1 * 10.0) // -1.0
    })
  })
})
