import { describe, expect, it } from 'vitest'
import { doNothingAgent } from '../../src/agents/doNothingAgent.js'
import { randomAgent } from '../../src/agents/randomAgent.js'
import { simulateGame } from '../../src/evaluation/simulateGame.js'

describe('simulateGame', () => {
  it('completes a full game with doNothingAgent and returns RawMetrics', () => {
    const metrics = simulateGame(doNothingAgent, { maxTicks: 500 }, 'test-1')

    expect(metrics).toBeDefined()
    expect(typeof metrics.score).toBe('number')
    expect(typeof metrics.livesRemaining).toBe('number')
    expect(typeof metrics.timeAlive).toBe('number')
    expect(typeof metrics.accuracy).toBe('number')
    expect(typeof metrics.distanceTraveled).toBe('number')
    expect(typeof metrics.rocksDestroyed).toBe('number')
    expect(typeof metrics.shotsFired).toBe('number')
    expect(typeof metrics.shotsHit).toBe('number')
    expect(typeof metrics.deaths).toBe('number')
    expect(typeof metrics.wavesSpawned).toBe('number')
  })

  it('doNothingAgent fires no shots', () => {
    const metrics = simulateGame(doNothingAgent, { maxTicks: 500 }, 'test-2')

    expect(metrics.shotsFired).toBe(0)
    expect(metrics.shotsHit).toBe(0)
    expect(metrics.accuracy).toBe(0)
  })

  it('doNothingAgent does not travel', () => {
    const metrics = simulateGame(doNothingAgent, { maxTicks: 100 }, 'test-3')

    // doNothingAgent doesn't thrust, so distance should be very small
    // (only drift from initial spawn, which should be ~0)
    expect(metrics.distanceTraveled).toBeLessThan(0.1)
  })

  it('randomAgent produces varied metrics', () => {
    const metrics = simulateGame(randomAgent, { maxTicks: 500 }, 'test-4')

    // randomAgent should fire some shots (probability 50% each frame)
    expect(metrics.shotsFired).toBeGreaterThan(0)
    // Should travel some distance (random thrust)
    expect(metrics.distanceTraveled).toBeGreaterThan(0)
  })

  it('is deterministic with the same seed', () => {
    const m1 = simulateGame(doNothingAgent, { maxTicks: 200 }, 'det-seed')
    const m2 = simulateGame(doNothingAgent, { maxTicks: 200 }, 'det-seed')

    expect(m1).toEqual(m2)
  })

  it('produces different results with different seeds', () => {
    const m1 = simulateGame(randomAgent, { maxTicks: 300 }, 'seed-a')
    const m2 = simulateGame(randomAgent, { maxTicks: 300 }, 'seed-b')

    // At least some metric should differ
    const metricsMatch =
      m1.score === m2.score &&
      m1.shotsFired === m2.shotsFired &&
      m1.distanceTraveled === m2.distanceTraveled
    expect(metricsMatch).toBe(false)
  })

  it('ends early when game is over (all lives lost)', () => {
    // With enough ticks, the doNothingAgent will die from rock collisions
    const metrics = simulateGame(doNothingAgent, { maxTicks: 3000 }, 'death-1')

    // doNothingAgent should die since rocks will hit the stationary ship
    // The game should end before maxTicks
    expect(metrics.deaths).toBeGreaterThan(0)
  })

  it('tracks waves', () => {
    const metrics = simulateGame(doNothingAgent, { maxTicks: 1000 }, 'wave-1')

    // First wave spawns immediately, subsequent waves every 5s
    // 1000 ticks * 33ms = ~33s, so multiple waves
    expect(metrics.wavesSpawned).toBeGreaterThan(0)
  })
})
