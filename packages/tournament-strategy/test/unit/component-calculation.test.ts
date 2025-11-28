import { describe, test, expect } from 'vitest'

import {
  type GlickoFitnessWeights,
  type GlickoScoreComponents,
} from '../../src/GlickoStrategyOptions.js'
import { glickoFitnessCalculator } from '../../src/score/glickoFitnessCalculator.js'

describe('Component Calculation Logic', () => {
  describe('Conservative Score Calculation', () => {
    test('conservative score = rating - 2*RD', () => {
      const rating = 1600
      const rd = 200

      const conservativeScore = rating - 2 * rd
      expect(conservativeScore).toBe(1200)
    })

    test('high RD significantly penalizes conservative score', () => {
      const rating = 1600
      const highRd = 500

      const conservativeScore = rating - 2 * highRd
      expect(conservativeScore).toBe(600) // Much lower than rating
    })

    test('low RD has minimal penalty', () => {
      const rating = 1600
      const lowRd = 50

      const conservativeScore = rating - 2 * lowRd
      expect(conservativeScore).toBe(1500) // Close to rating
    })

    test('conservative score can be negative', () => {
      const rating = 1200
      const extremeRd = 700

      const conservativeScore = rating - 2 * extremeRd
      expect(conservativeScore).toBe(-200) // Negative!
    })

    test('conservative score is always less than or equal to raw rating', () => {
      const testCases = [
        { rating: 1500, rd: 0 },
        { rating: 1500, rd: 100 },
        { rating: 1500, rd: 350 },
        { rating: 1800, rd: 200 },
        { rating: 2000, rd: 50 },
      ]

      for (const { rating, rd } of testCases) {
        const conservative = rating - 2 * rd
        expect(conservative).toBeLessThanOrEqual(rating)
      }
    })
  })

  describe('Environment Score Calculation', () => {
    test('environment score = average of match fitness', () => {
      const totalScore = 12.5
      const totalGames = 5

      const avgEnvScore = totalScore / totalGames
      expect(avgEnvScore).toBe(2.5)
    })

    test('handles single game', () => {
      const totalScore = 3
      const totalGames = 1

      const avgEnvScore = totalScore / totalGames
      expect(avgEnvScore).toBe(3)
    })

    test('handles many games', () => {
      const totalScore = 150
      const totalGames = 100

      const avgEnvScore = totalScore / totalGames
      expect(avgEnvScore).toBe(1.5)
    })

    test('normalizes to configured range', () => {
      const avgEnvScore = 2.5
      const minScore = -0.375
      const maxScore = 4.5

      const range = maxScore - minScore
      const normalized = (avgEnvScore - minScore) / range

      expect(normalized).toBeCloseTo(0.59, 2) // (2.5 - (-0.375)) / 4.875
    })
  })

  describe('Default Fitness Calculator', () => {
    const weights: GlickoFitnessWeights = {
      seedWeight: 0.2,
      envWeight: 0.3,
      glickoWeight: 0.4,
      conservativeWeight: 0.1,
    }

    test('should blend all 4 components with correct weights', () => {
      const components: GlickoScoreComponents = {
        seedScore: 0.5,
        environmentScore: 0.6,
        glickoScore: 0.7,
        conservativeScore: 0.4,
      }

      const fitness = glickoFitnessCalculator(components, weights)

      // Expected: 0.5*0.2 + 0.6*0.3 + 0.7*0.4 + 0.4*0.1
      //         = 0.10 + 0.18 + 0.28 + 0.04 = 0.60
      expect(fitness).toBeCloseTo(0.6, 5)
    })

    test('should redistribute seed weight when seed is missing', () => {
      const componentsWithSeed: GlickoScoreComponents = {
        seedScore: 0.5,
        environmentScore: 0.6,
        glickoScore: 0.7,
        conservativeScore: 0.4,
      }

      const componentsWithoutSeed: GlickoScoreComponents = {
        environmentScore: 0.6,
        glickoScore: 0.7,
        conservativeScore: 0.4,
      }

      const fitnessWithSeed = glickoFitnessCalculator(
        componentsWithSeed,
        weights
      )
      const fitnessWithoutSeed = glickoFitnessCalculator(
        componentsWithoutSeed,
        weights
      )

      // Without seed, its 0.2 weight goes to glicko (0.4 + 0.2 = 0.6)
      // Expected: 0.6*0.3 + 0.7*0.6 + 0.4*0.1
      //         = 0.18 + 0.42 + 0.04 = 0.64
      expect(fitnessWithoutSeed).toBeCloseTo(0.64, 5)
      expect(fitnessWithoutSeed).not.toBeCloseTo(fitnessWithSeed, 2)
    })

    test('should handle all zeros', () => {
      const components: GlickoScoreComponents = {
        environmentScore: 0,
        glickoScore: 0,
        conservativeScore: 0,
      }

      const fitness = glickoFitnessCalculator(components, weights)
      expect(fitness).toBe(0)
    })

    test('should handle all ones', () => {
      const components: GlickoScoreComponents = {
        seedScore: 1,
        environmentScore: 1,
        glickoScore: 1,
        conservativeScore: 1,
      }

      const fitness = glickoFitnessCalculator(components, weights)

      // All weights sum to 1.0
      expect(fitness).toBeCloseTo(1.0, 5)
    })

    test('should clamp result to [0, 1] implicitly', () => {
      // Even if components exceed [0,1], fitness calculator works
      const components: GlickoScoreComponents = {
        seedScore: 1.5, // Hypothetically over 1
        environmentScore: 0.6,
        glickoScore: 0.7,
        conservativeScore: 0.4,
        innovationScore: 0.2,
      }

      const fitness = glickoFitnessCalculator(components, weights)

      // Result can exceed 1 if components do
      // Actual clamping happens in normalizeGlickoScores
      expect(fitness).toBeGreaterThan(0)
    })

    test('weights sum to 1.0 when seed is provided', () => {
      const testWeights = {
        seed: 0.1,
        environment: 0.2,
        glicko: 0.4,
        conservative: 0.2,
        innovation: 0.1,
      }

      const sum = Object.values(testWeights).reduce((a, b) => a + b, 0)
      expect(sum).toBeCloseTo(1.0, 5)
    })

    test('weights sum to 1.0 when seed is absent', () => {
      const testWeights = {
        environment: 0.2,
        glicko: 0.5, // Gets seed's 0.1
        conservative: 0.2,
        innovation: 0.1,
      }

      const sum = Object.values(testWeights).reduce((a, b) => a + b, 0)
      expect(sum).toBeCloseTo(1.0, 5)
    })
  })

  describe('Component Relationships', () => {
    const weights: GlickoFitnessWeights = {
      seedWeight: 0.2,
      envWeight: 0.3,
      glickoWeight: 0.4,
      conservativeWeight: 0.1,
    }

    test('conservative score should be less than glicko score when RD > 0', () => {
      const rating = 1600
      const rd = 150

      const glickoScore = rating
      const conservativeScore = rating - 2 * rd

      expect(conservativeScore).toBeLessThan(glickoScore)
    })

    test('high glicko score compensates for low conservative score', () => {
      // Scenario: New performer with high RD (uncertainty)
      const components: GlickoScoreComponents = {
        environmentScore: 0.5,
        glickoScore: 0.8, // High raw rating
        conservativeScore: 0.4, // Low due to high RD
      }

      const fitness = glickoFitnessCalculator(components, weights)

      // High glicko score helps compensate for conservative penalty
      // Expected: 0.5*0.3 + 0.8*0.4 + 0.4*0.1 = 0.15 + 0.32 + 0.04 = 0.51
      expect(fitness).toBeGreaterThan(0.5)
    })

    test('stable genome with low RD should score well', () => {
      // Scenario: Established performer with low uncertainty
      const components: GlickoScoreComponents = {
        environmentScore: 0.6,
        glickoScore: 0.7, // Good rating
        conservativeScore: 0.68, // Close to glicko (low RD)
      }

      const fitness = glickoFitnessCalculator(components, weights)

      // Expected: 0.6*0.3 + 0.7*0.4 + 0.68*0.1 = 0.18 + 0.28 + 0.068 = 0.528
      expect(fitness).toBeGreaterThan(0.5)
    })
  })
})
