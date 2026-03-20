import {
  createGame,
  type PlayerInputs,
  resetIdCounter,
  startPlayer,
  step,
} from '@heygrady/hexagonoids-engine'
import { describe, expect, it } from 'vitest'

import { randomAgent } from '../../src/agents/randomAgent.js'
import type { AgentContext } from '../../src/agents/types.js'
import { captureSnapshot } from '../../src/scenarios/captureSnapshot.js'
import { restoreSnapshot } from '../../src/scenarios/restoreSnapshot.js'
import type { ScenarioSnapshot } from '../../src/scenarios/types.js'

const PLAYER_ID = 'player-1'

function createTestGame(seed: string) {
  resetIdCounter()
  const { state, rng } = createGame({ seed, useFastThrust: true })
  startPlayer(state, PLAYER_ID, rng)
  return { state, rng }
}

function tickGame(
  state: ReturnType<typeof createGame>['state'],
  rng: ReturnType<typeof createGame>['rng'],
  ticks: number
) {
  const context: AgentContext = { rng, memory: {} }
  const stepInputs: PlayerInputs = {
    [PLAYER_ID]: { left: false, right: false, thrust: false, fire: false },
  }
  for (let i = 0; i < ticks; i++) {
    if (state.endedAt != null) break
    const inputs = randomAgent(state, PLAYER_ID, context)
    stepInputs[PLAYER_ID] = inputs
    step(state, stepInputs, 33, rng)
  }
}

describe('captureSnapshot', () => {
  it('captures a valid snapshot from a running game', () => {
    const { state, rng } = createTestGame('capture-test-1')
    tickGame(state, rng, 50)

    const snapshot = captureSnapshot(state, PLAYER_ID)

    expect(snapshot.version).toBe(1)
    expect(snapshot.id).toContain('scenario-')
    expect(snapshot.difficulty).toBe(0)
    expect(snapshot.gameTime).toBe(state.now)
    expect(snapshot.wave).toBe(state.wave)
    expect(snapshot.ship).toBeDefined()
    expect(snapshot.player).toBeDefined()
    expect(snapshot.rocks.length).toBeGreaterThan(0)
  })

  it('accepts custom id and difficulty', () => {
    const { state, rng } = createTestGame('capture-test-2')
    tickGame(state, rng, 10)

    const snapshot = captureSnapshot(state, PLAYER_ID, {
      id: 'custom-id',
      difficulty: 0.75,
    })

    expect(snapshot.id).toBe('custom-id')
    expect(snapshot.difficulty).toBe(0.75)
  })
})

describe('restoreSnapshot round-trip', () => {
  it('preserves entity counts', () => {
    const { state, rng } = createTestGame('roundtrip-1')
    tickGame(state, rng, 50)

    const snapshot = captureSnapshot(state, PLAYER_ID)
    const { state: restored } = restoreSnapshot(snapshot)

    expect(restored.ships.size).toBe(1)
    expect(restored.players.size).toBe(1)
    expect(restored.rocks.size).toBe(snapshot.rocks.length)
    expect(restored.bullets.size).toBe(snapshot.bullets.length)
  })

  it('preserves ship position within 1e-6', () => {
    const { state, rng } = createTestGame('roundtrip-ship')
    tickGame(state, rng, 30)

    const snapshot = captureSnapshot(state, PLAYER_ID)
    const { state: restored } = restoreSnapshot(snapshot)

    const restoredShip = restored.ships.values().next().value
    if (restoredShip == null) throw new Error('Expected restored ship')
    expect(restoredShip.position[0]).toBeCloseTo(snapshot.ship.x, 6)
    expect(restoredShip.position[1]).toBeCloseTo(snapshot.ship.y, 6)
    expect(restoredShip.position[2]).toBeCloseTo(snapshot.ship.z, 6)
    expect(restoredShip.yaw).toBeCloseTo(snapshot.ship.yaw, 6)
    expect(restoredShip.angularVelocity[0]).toBeCloseTo(
      snapshot.ship.angularVelocityX,
      6
    )
    expect(restoredShip.angularVelocity[1]).toBeCloseTo(
      snapshot.ship.angularVelocityY,
      6
    )
    expect(restoredShip.angularVelocity[2]).toBeCloseTo(
      snapshot.ship.angularVelocityZ,
      6
    )
  })

  it('preserves rock state', () => {
    const { state, rng } = createTestGame('roundtrip-rocks')
    tickGame(state, rng, 50)

    const snapshot = captureSnapshot(state, PLAYER_ID)
    const { state: restored } = restoreSnapshot(snapshot)

    const restoredRocks = [...restored.rocks.values()]
    expect(restoredRocks.length).toBe(snapshot.rocks.length)

    for (let i = 0; i < snapshot.rocks.length; i++) {
      const expected = snapshot.rocks[i]
      const actual = restoredRocks[i]
      if (actual == null || expected == null) {
        throw new Error(`Missing rock at index ${i}`)
      }
      expect(actual.position[0]).toBeCloseTo(expected.x, 6)
      expect(actual.position[1]).toBeCloseTo(expected.y, 6)
      expect(actual.position[2]).toBeCloseTo(expected.z, 6)
      expect(actual.size).toBe(expected.size)
      expect(actual.value).toBe(expected.value)
    }
  })

  it('preserves player state', () => {
    const { state, rng } = createTestGame('roundtrip-player')
    tickGame(state, rng, 50)

    const snapshot = captureSnapshot(state, PLAYER_ID)
    const { state: restored } = restoreSnapshot(snapshot)

    const restoredPlayer = restored.players.get(PLAYER_ID)
    if (restoredPlayer == null) throw new Error('Expected restored player')
    expect(restoredPlayer.score).toBe(snapshot.player.score)
    expect(restoredPlayer.lives).toBe(snapshot.player.lives)
    expect(restoredPlayer.alive).toBe(snapshot.player.alive)
    expect(restoredPlayer.startedAt).toBe(snapshot.player.startedAt)
  })

  it('preserves game time and wave', () => {
    const { state, rng } = createTestGame('roundtrip-time')
    tickGame(state, rng, 100)

    const snapshot = captureSnapshot(state, PLAYER_ID)
    const { state: restored } = restoreSnapshot(snapshot)

    expect(restored.now).toBe(snapshot.gameTime)
    expect(restored.wave).toBe(snapshot.wave)
  })

  it('restored state can simulate without crashes', () => {
    const { state, rng } = createTestGame('roundtrip-simulate')
    tickGame(state, rng, 30)

    const snapshot = captureSnapshot(state, PLAYER_ID)
    const { state: restored, rng: restoredRng } = restoreSnapshot(snapshot)

    const stepInputs: PlayerInputs = {
      [PLAYER_ID]: { left: false, right: false, thrust: true, fire: false },
    }

    // Should not throw
    for (let i = 0; i < 20; i++) {
      step(restored, stepInputs, 33, restoredRng)
    }

    expect(restored.now).toBeGreaterThan(snapshot.gameTime)
  })

  it('is deterministic: same snapshot + same seed -> identical state', () => {
    const { state, rng } = createTestGame('roundtrip-determinism')
    tickGame(state, rng, 50)

    const snapshot = captureSnapshot(state, PLAYER_ID)

    const stepInputs: PlayerInputs = {
      [PLAYER_ID]: { left: true, right: false, thrust: true, fire: true },
    }

    // Run first restore sequentially (restoreSnapshot recycles previous entities)
    const { state: s1, rng: r1 } = restoreSnapshot(snapshot, 'det-seed')
    for (let i = 0; i < 30; i++) {
      step(s1, stepInputs, 33, r1)
    }
    const ship1 = s1.ships.values().next().value
    if (ship1 == null) throw new Error('Expected ship1')
    const pos1 = [ship1.position[0], ship1.position[1], ship1.position[2]]
    const now1 = s1.now

    // Run second restore (recycles first's entities)
    const { state: s2, rng: r2 } = restoreSnapshot(snapshot, 'det-seed')
    for (let i = 0; i < 30; i++) {
      step(s2, stepInputs, 33, r2)
    }
    const ship2 = s2.ships.values().next().value
    if (ship2 == null) throw new Error('Expected ship2')

    expect(ship2.position[0]).toBe(pos1[0])
    expect(ship2.position[1]).toBe(pos1[1])
    expect(ship2.position[2]).toBe(pos1[2])
    expect(s2.now).toBe(now1)
  })

  it('snapshot is JSON-serializable (lossless round-trip)', () => {
    const { state, rng } = createTestGame('roundtrip-json')
    tickGame(state, rng, 50)

    const snapshot = captureSnapshot(state, PLAYER_ID)
    const parsed = JSON.parse(JSON.stringify(snapshot)) as ScenarioSnapshot

    expect(parsed).toEqual(snapshot)
  })
})
