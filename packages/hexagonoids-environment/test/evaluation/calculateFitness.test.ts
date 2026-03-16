import { describe, expect, it } from 'vitest'
import {
  actionDiversityGate,
  applyBehavioralGates,
  calculateFitness,
  computeFitnessBreakdown,
  computeGateBreakdown,
  engagementGate,
  evaluateFullGameFitness,
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
    elapsedTicks: 0,
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
    expect(result).toBe(defaultGateConfig.turnGateFloor)
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
    expect(result).toBe(defaultGateConfig.turnGateFloor)
  })

  it('passes agent that turns in one direction', () => {
    const metrics = makeMetrics({
      aliveFrames: 1000,
      leftFrames: 200,
      rightFrames: 0,
    })
    const result = turnGate(metrics, defaultGateConfig)
    expect(result).toBeGreaterThan(defaultGateConfig.turnGateFloor)
  })

  it('returns turnFloor when aliveFrames is 0', () => {
    const metrics = makeMetrics({ aliveFrames: 0 })
    const result = turnGate(metrics, defaultGateConfig)
    expect(result).toBe(defaultGateConfig.turnGateFloor)
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

  it('penalizes when turns are nearly all in one direction', () => {
    const metrics = makeMetrics({
      aliveFrames: 1000,
      leftFrames: 299,
      rightFrames: 1,
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
      leftFrames: 299,
      rightFrames: 1,
    })
    const rightBias = makeMetrics({
      aliveFrames: 1000,
      leftFrames: 1,
      rightFrames: 299,
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
    // perfScore = 0.7*0 + 0.3*1.0 = 0.3, × survivalGate(1.0)
    // Behavioral gates no longer applied per-episode
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
    // survivalGate = 1 (no deaths)
    // fitness = 0 * survivalGate = 0
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
    // rocksNorm = 12/28 ≈ 0.43, accuracy=0.4
    // perfScore = 0.7*0.43 + 0.3*(0.4/0.3 capped 1.0) ≈ 0.6
    // survivalGate = 1 - 1/4 = 0.75 (possibleDeaths defaults to 4)
    // No behavioral gates per-episode
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

  it('fire-rate-based possibleKills caps at uniqueRocksSeen', () => {
    // With enough ticks, the rate cap exceeds rocks seen, so uniqueRocksSeen is the limit
    // 500 ticks, dtMs=33 → ticksPerShot=ceil(150/33)=5 → 500/5*0.3=30 rate cap
    // With 3 rocks seen → possibleKills = min(30, 3) = 3 → rocksNorm = 1/3
    const metrics = makeMetrics({
      score: 200,
      accuracy: 0.5,
      rocksDestroyed: 1,
      uniqueRocksSeen: 3,
      elapsedTicks: 500,
      shotsFired: 2,
      shotsHit: 1,
      aliveFrames: 1000,
      thrustFrames: 400,
      fireFrames: 200,
      leftFrames: 200,
      rightFrames: 200,
    })
    const ctx: FitnessContext = { dtMs: 33 }
    const withFewRocks = weightedFitnessSum(
      metrics,
      defaultWeights,
      defaultGateConfig,
      ctx
    )
    // With 50 rocks seen → possibleKills = min(30, 50) = 30 → rocksNorm = 1/30
    const metricsMany = makeMetrics({
      ...metrics,
      uniqueRocksSeen: 50,
    })
    const withManyRocks = weightedFitnessSum(
      metricsMany,
      defaultWeights,
      defaultGateConfig,
      ctx
    )
    expect(withFewRocks).toBeGreaterThan(withManyRocks)
  })

  it('rocksNorm floors at 0 when no rocks seen and none destroyed', () => {
    const metrics = makeMetrics({
      accuracy: 0.1,
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
    // rocksNorm = 0/1 = 0, accuracy=0.1, targetAccuracy=0.3
    // accuracyTerm = min(0.1/0.3, 1) ≈ 0.333
    // perfScore = 0.7*0 + 0.3*0.333 ≈ 0.1
    // survivalGate=1, no behavioral gates per-episode
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
      { rocksDestroyed: 0.9, accuracy: 0.1, targetAccuracy: 0.3 },
      defaultGateConfig,
      defaultContext
    )
    // Heavy accuracy weight (but accuracy is 0 here)
    const accHeavy = weightedFitnessSum(
      metrics,
      { rocksDestroyed: 0.1, accuracy: 0.9, targetAccuracy: 0.3 },
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

  it('returns identical values when all agents are identical', () => {
    const agents = [
      makeMetrics({ score: 100, timeAlive: 30000 }),
      makeMetrics({ score: 100, timeAlive: 30000 }),
      makeMetrics({ score: 100, timeAlive: 30000 }),
    ]
    const fitness = calculateFitness(agents, defaultContext)
    expect(fitness[0]).toBe(fitness[1])
    expect(fitness[1]).toBe(fitness[2])
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
      uniqueRocksSeen: 20,
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
      accuracy: 0.15,
      shotsFired: 10,
      shotsHit: 3,
      aliveFrames: 2400,
      thrustFrames: 600,
      fireFrames: 150,
      leftFrames: 500,
      rightFrames: 500,
      largeRocksSpawned: 8,
      uniqueRocksSeen: 20,
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

describe('evaluateFullGameFitness', () => {
  it('returns non-zero for typical agent with 4 deaths', () => {
    const metrics = makeMetrics({
      score: 800,
      accuracy: 0.3,
      rocksDestroyed: 20,
      uniqueRocksSeen: 40,
      shotsFired: 60,
      shotsHit: 18,
      deaths: 4,
      aliveFrames: 2400,
      thrustFrames: 800,
      fireFrames: 300,
      leftFrames: 600,
      rightFrames: 600,
      framesWithRocksInSOI: 1200,
      uniqueCellsVisited: 20,
      elapsedTicks: 3000,
    })
    const result = evaluateFullGameFitness(metrics)
    // With time-based possibleDeaths (~33 for 3000 ticks), 4 deaths → survivalGate ≈ 0.88
    expect(result).toBeGreaterThan(0.1)
  })

  it('uses elapsedTicks for possibleDeaths computation', () => {
    const metricsLong = makeMetrics({
      score: 500,
      accuracy: 0.2,
      rocksDestroyed: 10,
      uniqueRocksSeen: 20,
      deaths: 3,
      aliveFrames: 800,
      thrustFrames: 300,
      fireFrames: 100,
      leftFrames: 200,
      rightFrames: 200,
      elapsedTicks: 3000,
    })
    const metricsShort = makeMetrics({
      score: 500,
      accuracy: 0.2,
      rocksDestroyed: 10,
      uniqueRocksSeen: 20,
      deaths: 3,
      aliveFrames: 800,
      thrustFrames: 300,
      fireFrames: 100,
      leftFrames: 200,
      rightFrames: 200,
      elapsedTicks: 400,
    })
    const longResult = evaluateFullGameFitness(metricsLong)
    const shortResult = evaluateFullGameFitness(metricsShort)
    // Fewer elapsed ticks → fewer possibleDeaths → lower survivalGate for same deaths
    expect(shortResult).toBeLessThan(longResult)
  })
})

describe('applyBehavioralGates', () => {
  it('returns fitness unmodified when actions are diverse', () => {
    const metrics = makeMetrics({
      aliveFrames: 10000,
      thrustFrames: 4000,
      fireFrames: 2000,
      leftFrames: 3000,
      rightFrames: 3000,
    })
    const result = applyBehavioralGates(0.5, metrics, defaultGateConfig)
    // Diverse actions → gates near 1.0, fitness mostly preserved
    expect(result).toBeGreaterThan(0.3)
    expect(result).toBeLessThanOrEqual(0.5)
  })

  it('penalizes 0% thrust degenerate agent', () => {
    const metrics = makeMetrics({
      aliveFrames: 10000,
      thrustFrames: 0,
      fireFrames: 10000,
      leftFrames: 5000,
      rightFrames: 5000,
    })
    const result = applyBehavioralGates(0.5, metrics, defaultGateConfig)
    // 0% thrust → actionDiversityGate geometric mean includes zero → floor
    expect(result).toBeLessThan(0.1)
  })

  it('penalizes all-buttons-held degenerate agent', () => {
    const metrics = makeMetrics({
      aliveFrames: 10000,
      thrustFrames: 10000,
      fireFrames: 10000,
      leftFrames: 10000,
      rightFrames: 10000,
    })
    const result = applyBehavioralGates(0.5, metrics, defaultGateConfig)
    // 100% on all actions → high side penalty → gate near 0
    expect(result).toBeLessThan(0.1)
  })

  it('penalizes no-turn agent', () => {
    const metrics = makeMetrics({
      aliveFrames: 10000,
      thrustFrames: 4000,
      fireFrames: 2000,
      leftFrames: 0,
      rightFrames: 0,
    })
    const result = applyBehavioralGates(0.5, metrics, defaultGateConfig)
    // turnGate → floor for 0 turn frames
    expect(result).toBeLessThan(0.2)
  })

  it('penalizes all-left spinner', () => {
    const metrics = makeMetrics({
      aliveFrames: 10000,
      thrustFrames: 4000,
      fireFrames: 2000,
      leftFrames: 5000,
      rightFrames: 0,
    })
    const result = applyBehavioralGates(0.5, metrics, defaultGateConfig)
    // turnBiasGate penalizes 100% left bias
    expect(result).toBeLessThan(0.3)
  })

  it('returns 0 when fitness is 0', () => {
    const metrics = makeMetrics({
      aliveFrames: 10000,
      thrustFrames: 4000,
      fireFrames: 2000,
      leftFrames: 3000,
      rightFrames: 3000,
    })
    expect(applyBehavioralGates(0, metrics, defaultGateConfig)).toBe(0)
  })

  it('clamps result to [0, 1]', () => {
    const metrics = makeMetrics({
      aliveFrames: 10000,
      thrustFrames: 4000,
      fireFrames: 2000,
      leftFrames: 3000,
      rightFrames: 3000,
    })
    const result = applyBehavioralGates(1.5, metrics, defaultGateConfig)
    expect(result).toBeLessThanOrEqual(1)
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

describe('computeFitnessBreakdown', () => {
  it('breakdown.fitness === weightedFitnessSum()', () => {
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
      elapsedTicks: 3000,
    })
    const breakdown = computeFitnessBreakdown(
      metrics,
      defaultWeights,
      defaultGateConfig,
      defaultContext
    )
    const scalar = weightedFitnessSum(
      metrics,
      defaultWeights,
      defaultGateConfig,
      defaultContext
    )
    expect(breakdown.fitness).toBe(scalar)
  })

  it('exposes all intermediates', () => {
    const metrics = makeMetrics({
      accuracy: 0.3,
      rocksDestroyed: 5,
      uniqueRocksSeen: 20,
      deaths: 1,
      elapsedTicks: 500,
    })
    const breakdown = computeFitnessBreakdown(
      metrics,
      defaultWeights,
      defaultGateConfig,
      { dtMs: 33 }
    )
    expect(breakdown.rocksNorm).toBeGreaterThanOrEqual(0)
    expect(breakdown.rocksNorm).toBeLessThanOrEqual(1)
    expect(breakdown.accuracyNorm).toBeGreaterThanOrEqual(0)
    expect(breakdown.survivalGate).toBeGreaterThanOrEqual(0)
    expect(breakdown.effectiveMaxRocks).toBeGreaterThanOrEqual(1)
    expect(breakdown.rocksDestroyed).toBe(5)
    expect(breakdown.accuracy).toBe(0.3)
    expect(breakdown.uniqueRocksSeen).toBe(20)
    expect(breakdown.deaths).toBe(1)
    expect(breakdown.elapsedTicks).toBe(500)
  })
})

describe('computeGateBreakdown', () => {
  it('fields multiply to combined', () => {
    const frames = {
      thrustFrames: 4000,
      fireFrames: 2000,
      leftFrames: 3000,
      rightFrames: 3000,
      aliveFrames: 10000,
    }
    const gb = computeGateBreakdown(frames, defaultGateConfig)
    expect(gb.combined).toBeCloseTo(
      gb.actionGate * gb.turnGate * gb.throttleGate * gb.turnBiasGate
    )
  })

  it('combined matches applyBehavioralGates ratio', () => {
    const frames = {
      thrustFrames: 4000,
      fireFrames: 2000,
      leftFrames: 3000,
      rightFrames: 3000,
      aliveFrames: 10000,
    }
    const gb = computeGateBreakdown(frames, defaultGateConfig)
    const gated = applyBehavioralGates(1.0, frames, defaultGateConfig)
    // applyBehavioralGates(1.0, ...) = clamp(1.0 * combined, 0, 1) = combined (when <= 1)
    expect(gated).toBeCloseTo(gb.combined)
  })
})
