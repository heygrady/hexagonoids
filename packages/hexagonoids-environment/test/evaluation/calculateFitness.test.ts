import { describe, expect, it } from 'vitest'
import {
  actionDiversityGate,
  calculateFitness,
  engagementGate,
  survivalGate,
  weightedFitnessSum,
  zScore,
} from '../../src/evaluation/calculateFitness.js'
import type { RawMetrics } from '../../src/evaluation/RawMetrics.js'
import { DEFAULT_HEXAGONOIDS_ENVIRONMENT_CONFIG } from '../../src/HexagonoidsEnvironmentConfig.js'

const defaultWeights = DEFAULT_HEXAGONOIDS_ENVIRONMENT_CONFIG.fitnessWeights
const defaultGateConfig = DEFAULT_HEXAGONOIDS_ENVIRONMENT_CONFIG.gateConfig
const defaultSimConfig = DEFAULT_HEXAGONOIDS_ENVIRONMENT_CONFIG.simulation

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
    thrustFrames: 0,
    fireFrames: 0,
    leftFrames: 0,
    rightFrames: 0,
    aliveFrames: 0,
    largeRocksSpawned: 0,
    uniqueRocksSeen: 0,
    framesWithRocksInSOI: 0,
    uniqueCellsVisited: 0,
    ...overrides,
  }
}

describe('zScore', () => {
  it('computes a standard z-score', () => {
    expect(zScore(10, 5, 5)).toBe(1.0)
  })

  it('returns 0 when stdDev is 0 (zero variance)', () => {
    expect(zScore(5, 5, 0)).toBe(0)
  })

  it('returns 0 when stdDev is near-zero (floating point noise)', () => {
    expect(zScore(5, 5, 1e-18)).toBe(0)
  })

  it('returns negative z-score for below-mean value', () => {
    expect(zScore(0, 5, 5)).toBe(-1.0)
  })
})

describe('actionDiversityGate', () => {
  it('returns floor when one action is at 100%', () => {
    const metrics = makeMetrics({
      aliveFrames: 1000,
      thrustFrames: 1000,
      fireFrames: 0,
      leftFrames: 1000,
      rightFrames: 0,
    })
    const result = actionDiversityGate(metrics, defaultGateConfig)
    // Geometric mean includes zero factors → clamped to floor
    expect(result).toBe(defaultGateConfig.floor)
  })

  it('returns ~1.0 for healthy diverse usage', () => {
    const metrics = makeMetrics({
      aliveFrames: 1000,
      thrustFrames: 400,
      fireFrames: 200,
      leftFrames: 300,
      rightFrames: 300,
    })
    const result = actionDiversityGate(metrics, defaultGateConfig)
    expect(result).toBeGreaterThan(0.7)
  })

  it('returns floor when aliveFrames is 0', () => {
    const metrics = makeMetrics({ aliveFrames: 0 })
    const result = actionDiversityGate(metrics, defaultGateConfig)
    expect(result).toBe(defaultGateConfig.floor)
  })
})

describe('engagementGate', () => {
  it('returns floor when no frames with rocks in SOI', () => {
    const metrics = makeMetrics({
      aliveFrames: 1000,
      framesWithRocksInSOI: 0,
    })
    const result = engagementGate(metrics, defaultGateConfig)
    expect(result).toBe(defaultGateConfig.floor)
  })

  it('returns 1.0 when rocks in SOI every frame', () => {
    const metrics = makeMetrics({
      aliveFrames: 1000,
      framesWithRocksInSOI: 1000,
    })
    const result = engagementGate(metrics, defaultGateConfig)
    expect(result).toBe(1.0)
  })

  it('produces a gradient for partial engagement', () => {
    const metrics = makeMetrics({
      aliveFrames: 1000,
      framesWithRocksInSOI: 700,
    })
    const result = engagementGate(metrics, defaultGateConfig)
    expect(result).toBe(0.7)
  })

  it('returns floor when aliveFrames is 0', () => {
    const metrics = makeMetrics({ aliveFrames: 0 })
    const result = engagementGate(metrics, defaultGateConfig)
    expect(result).toBe(defaultGateConfig.floor)
  })
})

describe('survivalGate', () => {
  it('returns 1.0 for zero deaths', () => {
    const metrics = makeMetrics({ deaths: 0 })
    const result = survivalGate(metrics, defaultGateConfig, defaultSimConfig)
    expect(result).toBe(1.0)
  })

  it('penalizes deaths with exponential decay', () => {
    const m1 = makeMetrics({ deaths: 1 })
    const m2 = makeMetrics({ deaths: 3 })
    const r1 = survivalGate(m1, defaultGateConfig, defaultSimConfig)
    const r2 = survivalGate(m2, defaultGateConfig, defaultSimConfig)
    expect(r1).toBeLessThan(1.0)
    expect(r1).toBeGreaterThan(r2)
  })

  it('returns floor for many deaths', () => {
    const metrics = makeMetrics({ deaths: 100 })
    const result = survivalGate(metrics, defaultGateConfig, defaultSimConfig)
    expect(result).toBe(defaultGateConfig.floor)
  })
})

describe('weightedFitnessSum', () => {
  it('returns value in [0, 1]', () => {
    const metrics = makeMetrics({
      score: 500,
      accuracy: 0.5,
      rocksDestroyed: 5,
      aliveFrames: 1000,
      thrustFrames: 400,
      fireFrames: 200,
      leftFrames: 300,
      rightFrames: 300,
      shotsFired: 30,
      shotsHit: 15,
    })
    const result = weightedFitnessSum(
      metrics,
      defaultWeights,
      defaultSimConfig,
      defaultGateConfig
    )
    expect(result).toBeGreaterThan(0)
    expect(result).toBeLessThanOrEqual(1)
  })

  it('returns 0 for all-zero metrics (score=0, rocks=0 collapses geometric mean)', () => {
    const metrics = makeMetrics({
      livesRemaining: 0,
      timeAlive: 0,
      aliveFrames: 0,
    })
    const result = weightedFitnessSum(
      metrics,
      defaultWeights,
      defaultSimConfig,
      defaultGateConfig
    )
    expect(result).toBe(0)
  })

  it('degenerate spin-in-place scores 0 (score=0, rocks=0)', () => {
    const metrics = makeMetrics({
      score: 0,
      aliveFrames: 3000,
      thrustFrames: 0,
      fireFrames: 0,
      leftFrames: 3000, // spinning left 100%
      rightFrames: 0,
      shotsFired: 0,
      rocksDestroyed: 0,
    })
    const result = weightedFitnessSum(
      metrics,
      defaultWeights,
      defaultSimConfig,
      defaultGateConfig
    )
    // score=0 and rocks=0 → saturating returns 0 → geometric mean is 0
    expect(result).toBe(0)
  })

  it('degenerate floor-it-and-fire scores 0 (score=0, rocks=0)', () => {
    const metrics = makeMetrics({
      score: 0,
      aliveFrames: 3000,
      thrustFrames: 3000, // thrust 100%
      fireFrames: 3000, // fire 100%
      leftFrames: 0,
      rightFrames: 0,
      shotsFired: 200,
      shotsHit: 0,
      accuracy: 0,
      rocksDestroyed: 0,
    })
    const result = weightedFitnessSum(
      metrics,
      defaultWeights,
      defaultSimConfig,
      defaultGateConfig
    )
    // score=0 and rocks=0 → geometric mean is 0
    expect(result).toBe(0)
  })

  it('competent agent scores well', () => {
    const metrics = makeMetrics({
      score: 1200,
      accuracy: 0.4,
      rocksDestroyed: 12,
      shotsFired: 30,
      shotsHit: 12,
      deaths: 1,
      aliveFrames: 2400,
      thrustFrames: 800,
      fireFrames: 300,
      leftFrames: 600,
      rightFrames: 600,
    })
    const result = weightedFitnessSum(
      metrics,
      defaultWeights,
      defaultSimConfig,
      defaultGateConfig
    )
    expect(result).toBeGreaterThan(0.3)
  })

  it('uses possibleDeaths from context for survival term', () => {
    const metrics = makeMetrics({
      score: 1000,
      accuracy: 0.3,
      rocksDestroyed: 10,
      shotsFired: 30,
      shotsHit: 9,
      deaths: 10,
      aliveFrames: 2400,
      thrustFrames: 800,
      fireFrames: 300,
      leftFrames: 600,
      rightFrames: 600,
    })
    // With possibleDeaths=60 (20 scenarios × 3 lives), 10 deaths → survival = 0.833
    const result60 = weightedFitnessSum(
      metrics,
      defaultWeights,
      defaultSimConfig,
      defaultGateConfig,
      { possibleDeaths: 60 }
    )
    // With default possibleDeaths=3, 10 deaths → survival clamped to 0
    const resultDefault = weightedFitnessSum(
      metrics,
      defaultWeights,
      defaultSimConfig,
      defaultGateConfig
    )
    expect(result60).toBeGreaterThan(resultDefault)
  })
})

describe('calculateFitness', () => {
  it('returns empty array for empty input', () => {
    expect(calculateFitness([])).toEqual([])
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

  it('differentiates agents with different competence levels', () => {
    const competent = makeMetrics({
      score: 1000,
      rocksDestroyed: 10,
      timeAlive: 80000,
      accuracy: 0.5,
      shotsFired: 20,
      shotsHit: 10,
      aliveFrames: 2400,
      thrustFrames: 800,
      fireFrames: 200,
      leftFrames: 600,
      rightFrames: 600,
      largeRocksSpawned: 10,
      uniqueRocksSeen: 8,
      framesWithRocksInSOI: 1200,
      uniqueCellsVisited: 30,
    })
    const degenerate = makeMetrics({
      score: 0,
      rocksDestroyed: 0,
      timeAlive: 80000,
      aliveFrames: 2400,
      thrustFrames: 0,
      fireFrames: 0,
      leftFrames: 2400,
      rightFrames: 0,
      largeRocksSpawned: 4,
      uniqueRocksSeen: 0,
      uniqueCellsVisited: 1,
    })
    const middle = makeMetrics({
      score: 500,
      rocksDestroyed: 5,
      timeAlive: 80000,
      accuracy: 0.3,
      shotsFired: 10,
      shotsHit: 3,
      aliveFrames: 2400,
      thrustFrames: 600,
      fireFrames: 150,
      leftFrames: 500,
      rightFrames: 500,
      largeRocksSpawned: 8,
      uniqueRocksSeen: 5,
      framesWithRocksInSOI: 600,
      uniqueCellsVisited: 15,
    })

    const fitness = calculateFitness([competent, degenerate, middle])
    expect(fitness).toHaveLength(3)
    // Competent agent should score highest
    expect(fitness[0]).toBeGreaterThan(fitness[2]!)
    // Degenerate should score lowest
    expect(fitness[1]).toBeLessThan(fitness[2]!)
  })
})
