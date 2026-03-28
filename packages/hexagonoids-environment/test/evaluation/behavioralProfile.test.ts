import { describe, expect, it } from 'vitest'
import {
  computeBehavioralProfile,
  shannonEntropy,
} from '../../src/evaluation/behavioralProfile.js'
import type { RawMetrics } from '../../src/evaluation/RawMetrics.js'

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

describe('shannonEntropy', () => {
  it('returns 2.0 for uniform 4-action distribution', () => {
    expect(shannonEntropy([0.25, 0.25, 0.25, 0.25])).toBeCloseTo(2.0)
  })

  it('returns 0.0 for single-action agent', () => {
    expect(shannonEntropy([1, 0, 0, 0])).toBe(0)
  })

  it('returns 0.0 for all-zero fractions', () => {
    expect(shannonEntropy([0, 0, 0, 0])).toBe(0)
  })
})

describe('computeBehavioralProfile', () => {
  it('computes action profile with entropy', () => {
    const metrics = makeMetrics({
      aliveFrames: 1000,
      thrustFrames: 250,
      fireFrames: 250,
      leftFrames: 250,
      rightFrames: 250,
    })
    const profile = computeBehavioralProfile(metrics, 1)
    expect(profile.action.thrustPct).toBe(0.25)
    expect(profile.action.firePct).toBe(0.25)
    expect(profile.action.entropy).toBeCloseTo(2.0)
  })

  it('computes idle percentage', () => {
    const metrics = makeMetrics({
      aliveFrames: 1000,
      thrustFrames: 200,
      fireFrames: 100,
      leftFrames: 300,
      rightFrames: 100,
    })
    const profile = computeBehavioralProfile(metrics, 1)
    // idle = 1000 - max(200, 300, 100) = 700
    expect(profile.movement.idlePct).toBe(0.7)
  })

  it('averages distance and cells by seed count', () => {
    const metrics = makeMetrics({
      aliveFrames: 1000,
      distanceTraveled: 300,
      uniqueCellsVisited: 60,
    })
    const profile = computeBehavioralProfile(metrics, 3)
    expect(profile.movement.distanceTraveled).toBe(100)
    expect(profile.movement.uniqueCells).toBe(20)
  })

  it('computes engagement fraction', () => {
    const metrics = makeMetrics({
      aliveFrames: 1000,
      framesWithRocksInSOI: 700,
    })
    const profile = computeBehavioralProfile(metrics, 1)
    expect(profile.engagement.framesWithRocksInSOIPct).toBe(0.7)
  })

  it('handles zero aliveFrames gracefully', () => {
    const metrics = makeMetrics({ aliveFrames: 0 })
    const profile = computeBehavioralProfile(metrics, 1)
    expect(profile.action.entropy).toBeCloseTo(2.0) // defaults to uniform
    // With 0 aliveFrames, alive defaults to 1, idle = 1 - max(0,0,0) = 1
    expect(profile.movement.idlePct).toBe(1)
  })
})
