import {
  createGame,
  type PlayerInputs,
  resetIdCounter,
  startPlayer,
  step,
} from '@heygrady/hexagonoids-engine'
import { describe, expect, it } from 'vitest'

import { doNothingAgent } from '../../src/agents/doNothingAgent.js'
import { randomAgent } from '../../src/agents/randomAgent.js'
import type { AgentContext } from '../../src/agents/types.js'
import { captureSnapshot } from '../../src/scenarios/captureSnapshot.js'
import { simulateScenario } from '../../src/scenarios/simulateScenario.js'

const PLAYER_ID = 'player-1'

function createScenario(seed: string, ticks = 50) {
  resetIdCounter()
  const { state, rng } = createGame({ seed, useFastThrust: true })
  startPlayer(state, PLAYER_ID, rng)

  const context: AgentContext = { rng, memory: {}, executor: undefined }
  const stepInputs: PlayerInputs = {
    [PLAYER_ID]: { left: false, right: false, thrust: false, fire: false },
  }
  for (let i = 0; i < ticks; i++) {
    if (state.endedAt != null) break
    const inputs = randomAgent(state, PLAYER_ID, context)
    stepInputs[PLAYER_ID] = inputs
    step(state, stepInputs, 33, rng)
  }

  return captureSnapshot(state, PLAYER_ID, { id: `test-scenario-${seed}` })
}

describe('simulateScenario', () => {
  it('returns valid RawMetrics with doNothingAgent', () => {
    const scenario = createScenario('sim-scenario-1')
    const metrics = simulateScenario(
      doNothingAgent,
      scenario,
      { maxTicks: 120 },
      'eval-seed-1'
    )

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
    expect(typeof metrics.thrustFrames).toBe('number')
    expect(typeof metrics.fireFrames).toBe('number')
    expect(typeof metrics.leftFrames).toBe('number')
    expect(typeof metrics.rightFrames).toBe('number')
    expect(typeof metrics.aliveFrames).toBe('number')
    expect(typeof metrics.largeRocksSpawned).toBe('number')
    expect(typeof metrics.uniqueRocksSeen).toBe('number')
    expect(typeof metrics.framesWithRocksInSOI).toBe('number')
    expect(typeof metrics.uniqueCellsVisited).toBe('number')
  })

  it('randomAgent produces different metrics than doNothingAgent', () => {
    const scenario = createScenario('sim-scenario-2')
    const config = { maxTicks: 120 }

    const doNothingMetrics = simulateScenario(
      doNothingAgent,
      scenario,
      config,
      'eval-seed-2'
    )
    const randomMetrics = simulateScenario(
      randomAgent,
      scenario,
      config,
      'eval-seed-2'
    )

    // At least some metric should differ
    const allMatch =
      doNothingMetrics.shotsFired === randomMetrics.shotsFired &&
      doNothingMetrics.distanceTraveled === randomMetrics.distanceTraveled &&
      doNothingMetrics.thrustFrames === randomMetrics.thrustFrames
    expect(allMatch).toBe(false)
  })

  it('is deterministic with same scenario, seed, and agent', () => {
    const scenario = createScenario('sim-scenario-3')
    const config = { maxTicks: 120 }

    const m1 = simulateScenario(doNothingAgent, scenario, config, 'det-seed')
    const m2 = simulateScenario(doNothingAgent, scenario, config, 'det-seed')

    expect(m1).toEqual(m2)
  })

  it('reflects short duration (120 ticks)', () => {
    const scenario = createScenario('sim-scenario-4')
    const metrics = simulateScenario(
      doNothingAgent,
      scenario,
      { maxTicks: 120 },
      'eval-seed-4'
    )

    // timeAlive = delta time during scenario: up to 120 ticks × 33ms = 3960ms
    const maxExpectedTime = 120 * 33
    expect(metrics.timeAlive).toBeLessThanOrEqual(maxExpectedTime)
    expect(metrics.timeAlive).toBeGreaterThan(0)
  })

  it('returns delta metrics relative to snapshot baseline', () => {
    const scenario = createScenario('sim-scenario-delta', 100)
    // Scenario has non-zero gameTime from 100 ticks of play
    expect(scenario.gameTime).toBeGreaterThan(0)

    const metrics = simulateScenario(
      doNothingAgent,
      scenario,
      { maxTicks: 60 },
      'eval-seed-delta'
    )

    // timeAlive should be scenario duration only, not include snapshot gameTime
    expect(metrics.timeAlive).toBeLessThanOrEqual(60 * 33)
    expect(metrics.timeAlive).toBeGreaterThan(0)

    // score should be delta only (doNothing earns 0 points)
    expect(metrics.score).toBe(0)

    // wavesSpawned should be delta (60 ticks of doNothing won't trigger new waves)
    expect(metrics.wavesSpawned).toBe(0)
  })

  it('has aliveFrames > 0 when ship starts alive', () => {
    const scenario = createScenario('sim-scenario-5')
    expect(scenario.ship.alive).toBe(true)

    const metrics = simulateScenario(
      doNothingAgent,
      scenario,
      { maxTicks: 120 },
      'eval-seed-5'
    )

    expect(metrics.aliveFrames).toBeGreaterThan(0)
  })
})
