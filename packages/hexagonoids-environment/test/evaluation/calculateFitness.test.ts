import { describe, expect, it } from 'vitest'
import {
  actionDiversityGate,
  calculateFitness,
  engagementGate,
  type FitnessContext,
  turnBiasGate,
  turnGate,
  weightedFitnessSum,
  zScore,
} from '../../src/evaluation/calculateFitness.js'
import type { RawMetrics } from '../../src/evaluation/RawMetrics.js'
import { DEFAULT_HEXAGONOIDS_ENVIRONMENT_CONFIG } from '../../src/HexagonoidsEnvironmentConfig.js'

const defaultWeights = DEFAULT_HEXAGONOIDS_ENVIRONMENT_CONFIG.fitnessWeights
const defaultGateConfig = DEFAULT_HEXAGONOIDS_ENVIRONMENT_CONFIG.gateConfig

const defaultContext: FitnessContext = {}

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
    expect(result).toBe(defaultGateConfig.actionGateFloor)
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
    expect(result).toBe(defaultGateConfig.actionGateFloor)
  })
})

describe('turnGate', () => {
  it('returns turnFloor when agent never turns', () => {
    const metrics = makeMetrics({
      aliveFrames: 1000,
      leftFrames: 0,
      rightFrames: 0,
    })
    const result = turnGate(metrics, defaultGateConfig)
    expect(result).toBe(defaultGateConfig.turnFloor)
  })

  it('returns ~1.0 for healthy turn usage', () => {
    const metrics = makeMetrics({
      aliveFrames: 1000,
      leftFrames: 150,
      rightFrames: 150,
    })
    const result = turnGate(metrics, defaultGateConfig)
    expect(result).toBeGreaterThan(0.7)
  })

  it('gates feather-shooter that only thrusts and fires', () => {
    const metrics = makeMetrics({
      aliveFrames: 1000,
      thrustFrames: 400,
      fireFrames: 200,
      leftFrames: 0,
      rightFrames: 0,
    })
    const result = turnGate(metrics, defaultGateConfig)
    expect(result).toBe(defaultGateConfig.turnFloor)
  })

  it('passes agent that turns in one direction', () => {
    const metrics = makeMetrics({
      aliveFrames: 1000,
      leftFrames: 200,
      rightFrames: 0,
    })
    const result = turnGate(metrics, defaultGateConfig)
    expect(result).toBeGreaterThan(defaultGateConfig.turnFloor)
  })

  it('returns turnFloor when aliveFrames is 0', () => {
    const metrics = makeMetrics({ aliveFrames: 0 })
    const result = turnGate(metrics, defaultGateConfig)
    expect(result).toBe(defaultGateConfig.turnFloor)
  })
})

describe('turnBiasGate', () => {
  it('returns 1.0 when turns are perfectly balanced', () => {
    const metrics = makeMetrics({
      aliveFrames: 1000,
      leftFrames: 200,
      rightFrames: 200,
    })
    expect(turnBiasGate(metrics, defaultGateConfig)).toBe(1.0)
  })

  it('returns 1.0 when agent never turns', () => {
    const metrics = makeMetrics({
      aliveFrames: 1000,
      leftFrames: 0,
      rightFrames: 0,
    })
    expect(turnBiasGate(metrics, defaultGateConfig)).toBe(1.0)
  })

  it('returns 1.0 when bias is below threshold', () => {
    // 70/30 split = 0.7 bias, below default 0.8 threshold
    const metrics = makeMetrics({
      aliveFrames: 1000,
      leftFrames: 210,
      rightFrames: 90,
    })
    expect(turnBiasGate(metrics, defaultGateConfig)).toBe(1.0)
  })

  it('penalizes when 90% of turns are in one direction', () => {
    const metrics = makeMetrics({
      aliveFrames: 1000,
      leftFrames: 270,
      rightFrames: 30,
    })
    const result = turnBiasGate(metrics, defaultGateConfig)
    expect(result).toBeLessThan(1.0)
    expect(result).toBeGreaterThan(defaultGateConfig.turnBiasGateFloor)
  })

  it('returns floor when all turns are in one direction', () => {
    const metrics = makeMetrics({
      aliveFrames: 1000,
      leftFrames: 300,
      rightFrames: 0,
    })
    expect(turnBiasGate(metrics, defaultGateConfig)).toBe(
      defaultGateConfig.turnBiasGateFloor
    )
  })

  it('penalizes left-bias same as right-bias', () => {
    const leftBias = makeMetrics({
      aliveFrames: 1000,
      leftFrames: 270,
      rightFrames: 30,
    })
    const rightBias = makeMetrics({
      aliveFrames: 1000,
      leftFrames: 30,
      rightFrames: 270,
    })
    expect(turnBiasGate(leftBias, defaultGateConfig)).toBe(
      turnBiasGate(rightBias, defaultGateConfig)
    )
  })
})

describe('engagementGate', () => {
  it('returns floor when no frames with rocks in SOI', () => {
    const metrics = makeMetrics({
      aliveFrames: 1000,
      framesWithRocksInSOI: 0,
    })
    const result = engagementGate(metrics, defaultGateConfig)
    expect(result).toBe(defaultGateConfig.actionGateFloor)
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
    expect(result).toBe(defaultGateConfig.actionGateFloor)
  })
})

describe('weightedFitnessSum', () => {
  it('returns value in [0, 1]', () => {
    const metrics = makeMetrics({
      score: 500,
      accuracy: 0.5,
      rocksDestroyed: 5,
      uniqueRocksSeen: 20,
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
      defaultGateConfig,
      defaultContext
    )
    expect(result).toBeGreaterThan(0)
    expect(result).toBeLessThanOrEqual(1)
  })

  it('provides gradient even with zero rocks (weighted sum, not geometric mean)', () => {
    // Agent never killed a rock but has some accuracy and survived
    const metrics = makeMetrics({
      accuracy: 0.3,
      rocksDestroyed: 0,
      deaths: 0,
      aliveFrames: 1000,
      thrustFrames: 400,
      fireFrames: 200,
      leftFrames: 200,
      rightFrames: 200,
      shotsFired: 10,
      shotsHit: 3,
    })
    const result = weightedFitnessSum(
      metrics,
      defaultWeights,
      defaultGateConfig,
      defaultContext
    )
    // perfScore = 0.6*0 + 0.4*0.3 = 0.12, × gates × survivalGate(1.0)
    expect(result).toBeGreaterThan(0)
  })

  it('returns 0 for all-zero metrics with zero aliveFrames', () => {
    const metrics = makeMetrics({
      livesRemaining: 0,
      timeAlive: 0,
      aliveFrames: 0,
    })
    const result = weightedFitnessSum(
      metrics,
      defaultWeights,
      defaultGateConfig,
      defaultContext
    )
    // All components zero (rocks=0, accuracy=0)
    // perfScore = 0.6*0 + 0.4*0 = 0
    // survivalGate = 1 (no deaths), actionGate = floor, turnGate = turnFloor
    // fitness = 0 * gates = 0
    expect(result).toBe(0)
  })

  it('degenerate spin-in-place gets zero perfScore', () => {
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
      defaultGateConfig,
      defaultContext
    )
    // rocks=0, accuracy=0 → perfScore = 0
    // survivalGate=1, but perfScore=0 so fitness=0
    expect(result).toBe(0)
  })

  it('competent agent scores well', () => {
    const metrics = makeMetrics({
      score: 1200,
      accuracy: 0.4,
      rocksDestroyed: 12,
      uniqueRocksSeen: 28,
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
      defaultGateConfig,
      defaultContext
    )
    // effectiveMax = min(300, 28) = 28
    // rocksNorm = 12/28 ≈ 0.43, accuracy=0.4
    // perfScore = 0.6*0.43 + 0.4*0.4 = 0.418
    // survivalGate = 1 - 1/4 = 0.75 (possibleDeaths defaults to 4)
    expect(result).toBeGreaterThan(0.2)
  })

  it('uses possibleDeaths from context for survival gate', () => {
    const metrics = makeMetrics({
      score: 1000,
      accuracy: 0.3,
      rocksDestroyed: 10,
      uniqueRocksSeen: 20,
      shotsFired: 30,
      shotsHit: 9,
      deaths: 10,
      aliveFrames: 2400,
      thrustFrames: 800,
      fireFrames: 300,
      leftFrames: 600,
      rightFrames: 600,
    })
    // With possibleDeaths=60, 10 deaths → survivalGate = 0.833
    const result60 = weightedFitnessSum(
      metrics,
      defaultWeights,
      defaultGateConfig,
      {
        ...defaultContext,
        possibleDeaths: 60,
      }
    )
    // With default possibleDeaths=4, 10 deaths → survivalGate clamped to 0
    const resultDefault = weightedFitnessSum(
      metrics,
      defaultWeights,
      defaultGateConfig,
      defaultContext
    )
    expect(result60).toBeGreaterThan(resultDefault)
  })

  it('SOI-capped rocksNorm gives stronger signal for fewer visible rocks', () => {
    const metrics = makeMetrics({
      score: 200,
      accuracy: 0.5,
      rocksDestroyed: 1,
      uniqueRocksSeen: 3,
      shotsFired: 2,
      shotsHit: 1,
      aliveFrames: 1000,
      thrustFrames: 400,
      fireFrames: 200,
      leftFrames: 200,
      rightFrames: 200,
    })
    // effectiveMax = min(rateCap, 3) = 3
    // rocksNorm = 1/3 ≈ 0.33
    const withFewRocks = weightedFitnessSum(
      metrics,
      defaultWeights,
      defaultGateConfig,
      defaultContext
    )
    // Same kills but many more rocks seen → weaker signal
    const metricsMany = makeMetrics({
      ...metrics,
      uniqueRocksSeen: 50,
    })
    // effectiveMax = min(rateCap, 50) = 50
    // rocksNorm = 1/50 = 0.02
    const withManyRocks = weightedFitnessSum(
      metricsMany,
      defaultWeights,
      defaultGateConfig,
      defaultContext
    )
    expect(withFewRocks).toBeGreaterThan(withManyRocks)
  })

  it('rocksNorm floors at 0 when no rocks seen and none destroyed', () => {
    const metrics = makeMetrics({
      accuracy: 0.5,
      deaths: 0,
      aliveFrames: 1000,
      thrustFrames: 400,
      fireFrames: 200,
      leftFrames: 200,
      rightFrames: 200,
      uniqueRocksSeen: 0,
      rocksDestroyed: 0,
    })
    const result = weightedFitnessSum(
      metrics,
      defaultWeights,
      defaultGateConfig,
      defaultContext
    )
    // rocksNorm = 0/1 = 0, accuracy=0.5
    // perfScore = 0.6*0 + 0.4*0.5 = 0.2
    // survivalGate=1, still gets signal from accuracy
    expect(result).toBeGreaterThan(0.02)
    expect(result).toBeLessThan(0.4)
  })

  it('weights control component influence', () => {
    const metrics = makeMetrics({
      rocksDestroyed: 14,
      uniqueRocksSeen: 28,
      accuracy: 0.0,
      deaths: 3,
      aliveFrames: 1000,
      thrustFrames: 400,
      fireFrames: 200,
      leftFrames: 200,
      rightFrames: 200,
    })
    // Heavy rocks weight
    const rocksHeavy = weightedFitnessSum(
      metrics,
      { rocksDestroyed: 0.9, accuracy: 0.1 },
      defaultGateConfig,
      defaultContext
    )
    // Heavy accuracy weight (but accuracy is 0 here)
    const accHeavy = weightedFitnessSum(
      metrics,
      { rocksDestroyed: 0.1, accuracy: 0.9 },
      defaultGateConfig,
      defaultContext
    )
    // Rocks-heavy should score much higher (14/28 = 0.5 rocks vs 0 accuracy)
    expect(rocksHeavy).toBeGreaterThan(accHeavy)
  })
})

describe('calculateFitness', () => {
  it('returns empty array for empty input', () => {
    expect(calculateFitness([], defaultContext)).toEqual([])
  })

  it('returns all zeros when all agents are identical', () => {
    const agents = [
      makeMetrics({ score: 100, timeAlive: 30000 }),
      makeMetrics({ score: 100, timeAlive: 30000 }),
      makeMetrics({ score: 100, timeAlive: 30000 }),
    ]
    const fitness = calculateFitness(agents, defaultContext)
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

    const fitness = calculateFitness(
      [competent, degenerate, middle],
      defaultContext
    )
    expect(fitness).toHaveLength(3)
    // Competent agent should score highest
    expect(fitness[0]).toBeGreaterThan(fitness[2]!)
    // Degenerate should score lowest
    expect(fitness[1]).toBeLessThan(fitness[2]!)
  })
})

describe('easing curve shape', () => {
  it('actionDiversityGate produces expected shape with quad easing', () => {
    const quadGate = {
      ...defaultGateConfig,
      actionEasing: 'quad' as const,
      actionLow: 0.1,
      actionHigh: 0.6,
    }

    // In the sweet zone → near 1.0
    const sweetSpot = actionDiversityGate(
      makeMetrics({
        aliveFrames: 1000,
        thrustFrames: 300,
        fireFrames: 200,
        leftFrames: 200,
        rightFrames: 200,
      }),
      quadGate
    )
    expect(sweetSpot).toBeGreaterThan(0.8)

    // Just above high → still close to 1 (gentle departure with easeIn)
    const justAbove = actionDiversityGate(
      makeMetrics({
        aliveFrames: 1000,
        thrustFrames: 650,
        fireFrames: 200,
        leftFrames: 200,
        rightFrames: 200,
      }),
      quadGate
    )
    expect(justAbove).toBeGreaterThan(0.5)

    // Saturated → heavily penalized
    const saturated = actionDiversityGate(
      makeMetrics({
        aliveFrames: 1000,
        thrustFrames: 950,
        fireFrames: 200,
        leftFrames: 200,
        rightFrames: 200,
      }),
      quadGate
    )
    expect(saturated).toBeLessThan(sweetSpot)
  })

  it('survivalGateFloor prevents zero survival score', () => {
    const config = {
      ...defaultGateConfig,
      survivalGateFloor: 0.25,
    }
    // Many deaths → survival would be 0 without floor
    const metrics = makeMetrics({
      accuracy: 0.5,
      rocksDestroyed: 10,
      uniqueRocksSeen: 20,
      deaths: 10,
      aliveFrames: 1000,
      thrustFrames: 400,
      fireFrames: 200,
      leftFrames: 200,
      rightFrames: 200,
    })
    const result = weightedFitnessSum(
      metrics,
      defaultWeights,
      config,
      defaultContext
    )
    // With survivalGateFloor=0.25, result should be > 0 even with many deaths
    expect(result).toBeGreaterThan(0)
  })
})
