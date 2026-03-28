import { describe, expect, it } from 'vitest'
import {
  applyBehavioralGates,
  calculateBehavioralGate,
  calculateFitness,
  computeFitnessBreakdown,
  computeGateBreakdown,
  engagementGate,
  evaluateFullGameFitness,
  type FitnessContext,
  weightedFitnessSum,
  zScore,
} from '../../src/evaluation/calculateFitness.js'
import type { RawMetrics } from '../../src/evaluation/RawMetrics.js'
import {
  DEFAULT_BEHAVIORAL_GATE_CONFIG,
  DEFAULT_HEXAGONOIDS_ENVIRONMENT_CONFIG,
} from '../../src/HexagonoidsEnvironmentConfig.js'

const defaultWeights = DEFAULT_HEXAGONOIDS_ENVIRONMENT_CONFIG.fitnessWeights
const defaultGateConfig = DEFAULT_HEXAGONOIDS_ENVIRONMENT_CONFIG.gateConfig
const defaultBehavioralConfig = DEFAULT_BEHAVIORAL_GATE_CONFIG

const defaultContext: FitnessContext = {}

function makeMetrics(overrides: Partial<RawMetrics> = {}): RawMetrics {
  const metrics: RawMetrics = {
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
    turnFrames: 0,
    leftFrames: 0,
    rightFrames: 0,
    turnConflictFrames: 0,
    turnAmbiguousFrames: 0,
    aliveFrames: 0,
    largeRocksSpawned: 0,
    uniqueRocksSeen: 0,
    framesWithRocksInSOI: 0,
    uniqueCellsVisited: 0,
    elapsedTicks: 0,
    ...overrides,
  }
  return {
    ...metrics,
    turnFrames:
      overrides.turnFrames ??
      Math.min(metrics.aliveFrames, metrics.leftFrames + metrics.rightFrames),
    turnConflictFrames: overrides.turnConflictFrames ?? 0,
    turnAmbiguousFrames: overrides.turnAmbiguousFrames ?? 0,
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

describe('calculateBehavioralGate', () => {
  it('returns per-action floors when aliveFrames is 0', () => {
    const metrics = makeMetrics({ aliveFrames: 0 })
    const result = calculateBehavioralGate(metrics, defaultBehavioralConfig)
    // All actions at floor: (0.3 * 0.3 * 0.1 * 1.0)^0.25 ≈ 0.31
    expect(result).toBeGreaterThan(defaultBehavioralConfig.floor)
    expect(result).toBeLessThan(0.5)
  })

  it('returns ~1.0 for healthy diverse usage', () => {
    const metrics = makeMetrics({
      aliveFrames: 1000,
      thrustFrames: 400,
      fireFrames: 200,
      leftFrames: 150,
      rightFrames: 150,
    })
    const result = calculateBehavioralGate(metrics, defaultBehavioralConfig)
    expect(result).toBeGreaterThan(0.8)
  })

  it('penalizes run-n-gun (high thrust, high fire, zero turn) moderately', () => {
    const metrics = makeMetrics({
      aliveFrames: 1000,
      thrustFrames: 800,
      fireFrames: 500,
      leftFrames: 0,
      rightFrames: 0,
    })
    const result = calculateBehavioralGate(metrics, defaultBehavioralConfig)
    // Turn gate at floor (0.1), but thrust and fire healthy.
    // Geometric mean: (thrust * fire * 0.1 * 1.0)^0.25 should be moderate
    expect(result).toBeGreaterThan(defaultBehavioralConfig.floor)
    expect(result).toBeLessThan(0.8)
  })

  it('penalizes do-nothing agent to combined floor', () => {
    const metrics = makeMetrics({
      aliveFrames: 1000,
      thrustFrames: 0,
      fireFrames: 0,
      leftFrames: 0,
      rightFrames: 0,
    })
    const result = calculateBehavioralGate(metrics, defaultBehavioralConfig)
    // All per-action gates at their floors: (0.3 * 0.3 * 0.1 * 1.0)^0.25
    expect(result).toBeGreaterThanOrEqual(defaultBehavioralConfig.floor)
    expect(result).toBeLessThan(0.5)
  })

  it('per-action floors prevent catastrophic combined value', () => {
    // Worst case: all actions at floor
    const metrics = makeMetrics({
      aliveFrames: 1000,
      thrustFrames: 0,
      fireFrames: 0,
      leftFrames: 0,
      rightFrames: 0,
    })
    const result = calculateBehavioralGate(metrics, defaultBehavioralConfig)
    // (0.3 * 0.3 * 0.1 * 1.0)^0.25 ≈ 0.42, much better than old 0.0000002
    expect(result).toBeGreaterThan(0.05)
  })

  it('turn bias penalizes all-left turning', () => {
    const metrics = makeMetrics({
      aliveFrames: 1000,
      thrustFrames: 400,
      fireFrames: 200,
      leftFrames: 300,
      rightFrames: 0, // 100% left bias
    })
    const result = calculateBehavioralGate(metrics, defaultBehavioralConfig)
    const balanced = calculateBehavioralGate(
      makeMetrics({
        aliveFrames: 1000,
        thrustFrames: 400,
        fireFrames: 200,
        leftFrames: 150,
        rightFrames: 150,
      }),
      defaultBehavioralConfig
    )
    expect(result).toBeLessThan(balanced)
  })

  it('turn bias is symmetric', () => {
    const leftBias = makeMetrics({
      aliveFrames: 1000,
      thrustFrames: 400,
      fireFrames: 200,
      leftFrames: 290,
      rightFrames: 10,
    })
    const rightBias = makeMetrics({
      aliveFrames: 1000,
      thrustFrames: 400,
      fireFrames: 200,
      leftFrames: 10,
      rightFrames: 290,
    })
    expect(
      calculateBehavioralGate(leftBias, defaultBehavioralConfig)
    ).toBeCloseTo(calculateBehavioralGate(rightBias, defaultBehavioralConfig))
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
      {
        rocksDestroyed: 0.9,
        accuracy: 0.1,
        targetAccuracy: 0.3,
        targetKillRatio: 1.0,
      },
      defaultGateConfig,
      defaultContext
    )
    // Heavy accuracy weight (but accuracy is 0 here)
    const accHeavy = weightedFitnessSum(
      metrics,
      {
        rocksDestroyed: 0.1,
        accuracy: 0.9,
        targetAccuracy: 0.3,
        targetKillRatio: 1.0,
      },
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
    const result = applyBehavioralGates(0.5, metrics, defaultBehavioralConfig)
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
    const result = applyBehavioralGates(0.5, metrics, defaultBehavioralConfig)
    // 0% thrust → thrust gate at floor, but not catastrophic
    expect(result).toBeLessThan(0.5)
    expect(result).toBeGreaterThan(0)
  })

  it('penalizes all-buttons-held degenerate agent', () => {
    const metrics = makeMetrics({
      aliveFrames: 10000,
      thrustFrames: 10000,
      fireFrames: 10000,
      leftFrames: 10000,
      rightFrames: 10000,
    })
    const result = applyBehavioralGates(0.5, metrics, defaultBehavioralConfig)
    // 100% on all actions → high side penalty on thrust and fire
    expect(result).toBeLessThan(0.3)
  })

  it('penalizes no-turn agent', () => {
    const metrics = makeMetrics({
      aliveFrames: 10000,
      thrustFrames: 4000,
      fireFrames: 2000,
      leftFrames: 0,
      rightFrames: 0,
    })
    const result = applyBehavioralGates(0.5, metrics, defaultBehavioralConfig)
    // turn gate at floor (0.1), geometric mean pulls combined down
    expect(result).toBeLessThan(0.5)
  })

  it('penalizes all-left spinner', () => {
    const metrics = makeMetrics({
      aliveFrames: 10000,
      thrustFrames: 4000,
      fireFrames: 2000,
      leftFrames: 5000,
      rightFrames: 0,
    })
    const result = applyBehavioralGates(0.5, metrics, defaultBehavioralConfig)
    // turnBias gate penalizes 100% left bias
    expect(result).toBeLessThan(0.5)
  })

  it('returns 0 when fitness is 0', () => {
    const metrics = makeMetrics({
      aliveFrames: 10000,
      thrustFrames: 4000,
      fireFrames: 2000,
      leftFrames: 3000,
      rightFrames: 3000,
    })
    expect(applyBehavioralGates(0, metrics, defaultBehavioralConfig)).toBe(0)
  })

  it('clamps result to [0, 1]', () => {
    const metrics = makeMetrics({
      aliveFrames: 10000,
      thrustFrames: 4000,
      fireFrames: 2000,
      leftFrames: 3000,
      rightFrames: 3000,
    })
    const result = applyBehavioralGates(1.5, metrics, defaultBehavioralConfig)
    expect(result).toBeLessThanOrEqual(1)
  })
})

describe('easing curve shape', () => {
  it('calculateBehavioralGate produces expected shape with quad easing', () => {
    const quadConfig = {
      ...defaultBehavioralConfig,
      thrust: { ...defaultBehavioralConfig.thrust, easing: 'quad' as const },
      fire: { ...defaultBehavioralConfig.fire, easing: 'quad' as const },
      turn: { ...defaultBehavioralConfig.turn, easing: 'quad' as const },
    }

    // In the sweet zone → near 1.0
    const sweetSpot = calculateBehavioralGate(
      makeMetrics({
        aliveFrames: 1000,
        thrustFrames: 300,
        fireFrames: 200,
        leftFrames: 200,
        rightFrames: 200,
      }),
      quadConfig
    )
    expect(sweetSpot).toBeGreaterThan(0.8)

    // Saturated thrust → penalized
    const saturated = calculateBehavioralGate(
      makeMetrics({
        aliveFrames: 1000,
        thrustFrames: 950,
        fireFrames: 200,
        leftFrames: 200,
        rightFrames: 200,
      }),
      quadConfig
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
  it('combined is geometric mean of per-action gates', () => {
    const frames = {
      thrustFrames: 4000,
      fireFrames: 2000,
      turnFrames: 6000,
      leftFrames: 3000,
      rightFrames: 3000,
      turnConflictFrames: 0,
      aliveFrames: 10000,
    }
    const gb = computeGateBreakdown(frames, defaultBehavioralConfig)
    const expected = Math.max(
      (gb.thrust * gb.fire * gb.turn * gb.turnBias) ** 0.25,
      defaultBehavioralConfig.floor
    )
    expect(gb.combined).toBeCloseTo(expected)
  })

  it('combined matches applyBehavioralGates ratio', () => {
    const frames = {
      thrustFrames: 4000,
      fireFrames: 2000,
      turnFrames: 6000,
      leftFrames: 3000,
      rightFrames: 3000,
      turnConflictFrames: 0,
      aliveFrames: 10000,
    }
    const gb = computeGateBreakdown(frames, defaultBehavioralConfig)
    const gated = applyBehavioralGates(1.0, frames, defaultBehavioralConfig)
    expect(gated).toBeCloseTo(gb.combined)
  })

  it('returns per-action gate values', () => {
    const frames = {
      thrustFrames: 4000,
      fireFrames: 2000,
      turnFrames: 6000,
      leftFrames: 3000,
      rightFrames: 3000,
      turnConflictFrames: 0,
      aliveFrames: 10000,
    }
    const gb = computeGateBreakdown(frames, defaultBehavioralConfig)
    expect(gb.thrust).toBeGreaterThan(0)
    expect(gb.fire).toBeGreaterThan(0)
    expect(gb.turn).toBeGreaterThan(0)
    expect(gb.turnBias).toBe(1.0) // balanced turns
  })
})
