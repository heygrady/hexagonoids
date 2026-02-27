import { describe, expect, it } from 'vitest'
import {
  calculateFitness,
  weightedFitnessSum,
  zScore,
} from '../../src/evaluation/calculateFitness.js'
import type { RawMetrics } from '../../src/evaluation/RawMetrics.js'

describe('zScore', () => {
  it('computes a standard z-score', () => {
    expect(zScore(10, 5, 5)).toBe(1.0)
  })

  it('returns 0 when stdDev is 0 (zero variance)', () => {
    expect(zScore(5, 5, 0)).toBe(0)
  })

  it('returns negative z-score for below-mean value', () => {
    expect(zScore(0, 5, 5)).toBe(-1.0)
  })
})

function makeMetrics(overrides: Partial<RawMetrics> = {}): RawMetrics {
  return {
    episodeReward: 0,
    score: 0,
    livesRemaining: 3,
    timeAlive: 10000,
    accuracy: 0,
    distanceTraveled: 0,
    rocksDestroyed: 0,
    shotsFired: 0,
    shotsHit: 0,
    deaths: 0,
    wavesSpawned: 1,
    ...overrides,
  }
}

describe('weightedFitnessSum', () => {
  const defaultWeights = {
    score: 0.3,
    livesRemaining: 0.2,
    accuracy: 0.15,
    distanceTraveled: 0.15,
    rocksDestroyed: 0.1,
    timeAlive: 0.1,
  }
  const defaultSimConfig = { maxTicks: 3000, dtMs: 33, useFastThrust: true }

  it('returns 0 for an agent with all-zero metrics', () => {
    const metrics = makeMetrics({
      livesRemaining: 0,
      timeAlive: 0,
    })
    const result = weightedFitnessSum(metrics, defaultWeights, defaultSimConfig)
    expect(result).toBe(0)
  })

  it('returns a positive number for an agent with some performance', () => {
    const metrics = makeMetrics({
      score: 500,
      livesRemaining: 2,
      accuracy: 0.5,
      distanceTraveled: 5,
      rocksDestroyed: 5,
      timeAlive: 50000,
    })
    const result = weightedFitnessSum(metrics, defaultWeights, defaultSimConfig)
    expect(result).toBeGreaterThan(0)
    expect(result).toBeLessThanOrEqual(1)
  })

  it('penalizes death-heavy behavior', () => {
    const safe = makeMetrics({
      score: 1200,
      rocksDestroyed: 12,
      timeAlive: 95000,
      deaths: 0,
      livesRemaining: 2,
      shotsFired: 30,
      shotsHit: 12,
      accuracy: 0.4,
    })
    const risky = makeMetrics({
      ...safe,
      deaths: 3,
      livesRemaining: 0,
    })

    const safeFitness = weightedFitnessSum(
      safe,
      defaultWeights,
      defaultSimConfig
    )
    const riskyFitness = weightedFitnessSum(
      risky,
      defaultWeights,
      defaultSimConfig
    )
    expect(safeFitness).toBeGreaterThan(riskyFitness)
  })
})

describe('calculateFitness', () => {
  it('returns empty array for empty input', () => {
    expect(calculateFitness([])).toEqual([])
  })

  it('returns correct relative ordering for 3 agents', () => {
    const agents = [
      makeMetrics({ score: 100, rocksDestroyed: 2, timeAlive: 30000 }),
      makeMetrics({ score: 500, rocksDestroyed: 10, timeAlive: 60000 }),
      makeMetrics({ score: 1000, rocksDestroyed: 20, timeAlive: 90000 }),
    ]
    const fitness = calculateFitness(agents)
    expect(fitness).toHaveLength(3)
    // Best agent should have highest fitness
    expect(fitness[2]).toBeGreaterThan(fitness[1]!)
    expect(fitness[1]).toBeGreaterThan(fitness[0]!)
  })

  it('returns all zeros when all agents are identical', () => {
    const agents = [
      makeMetrics({ score: 100, timeAlive: 30000 }),
      makeMetrics({ score: 100, timeAlive: 30000 }),
      makeMetrics({ score: 100, timeAlive: 30000 }),
    ]
    const fitness = calculateFitness(agents)
    for (const f of fitness) {
      expect(f).toBe(0)
    }
  })

  it('weights determine which agent scores higher (score vs survival)', () => {
    const highScore = makeMetrics({
      score: 1000,
      livesRemaining: 0,
      timeAlive: 10000,
    })
    const highSurvival = makeMetrics({
      score: 100,
      livesRemaining: 3,
      timeAlive: 90000,
    })
    const neutral = makeMetrics({
      score: 500,
      livesRemaining: 1,
      timeAlive: 50000,
    })

    // With heavy score weight, high-score agent wins
    const scoreWeighted = calculateFitness([highScore, highSurvival, neutral], {
      score: 0.9,
      livesRemaining: 0.02,
      accuracy: 0.02,
      distanceTraveled: 0.02,
      rocksDestroyed: 0.02,
      timeAlive: 0.02,
    })
    expect(scoreWeighted[0]).toBeGreaterThan(scoreWeighted[1]!)

    // With heavy survival weight, high-survival agent wins
    const survivalWeighted = calculateFitness(
      [highScore, highSurvival, neutral],
      {
        score: 0.02,
        livesRemaining: 0.45,
        accuracy: 0.02,
        distanceTraveled: 0.02,
        rocksDestroyed: 0.02,
        timeAlive: 0.45,
      }
    )
    expect(survivalWeighted[1]).toBeGreaterThan(survivalWeighted[0]!)
  })
})
