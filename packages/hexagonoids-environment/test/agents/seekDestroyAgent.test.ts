import type { RockState } from '@heygrady/hexagonoids-engine'
import { createGame, startPlayer } from '@heygrady/hexagonoids-engine'
import { createRNG } from '@neat-evolution/utils'
import { describe, expect, it } from 'vitest'
import { seekDestroyAgent } from '../../src/agents/seekDestroyAgent.js'
import type { AgentContext } from '../../src/agents/types.js'
import { simulateGame } from '../../src/evaluation/simulateGame.js'

const PLAYER_ID = 'player-1'

function createTestContext(seed = 'test'): AgentContext {
  return { rng: createRNG(seed), memory: {} }
}

/** Get ship for test player. Throws if not found. */
function getShip(state: ReturnType<typeof createGame>['state']) {
  const player = state.players.get(PLAYER_ID)
  if (player == null || player.shipId == null) throw new Error('no player')
  const ship = state.ships.get(player.shipId)
  if (ship == null) throw new Error('no ship')
  return ship
}

/** Create a mock rock at given lat/lng. Uses type assertion for test convenience. */
function mockRock(
  id: string,
  lat: number,
  lng: number,
  size: 0 | 1 | 2 = 2
): RockState {
  return {
    id,
    orientation: { x: 0, y: 0, z: 0, w: 1 },
    lat,
    lng,
    angularVelocity: { x: 0, y: 0, z: 0 },
    size,
    value: size === 2 ? 50 : size === 1 ? 100 : 200,
  } as unknown as RockState
}

describe('seekDestroyAgent', () => {
  it('returns no-op when ship is dead', () => {
    const { state, rng } = createGame({ seed: 'dead-ship' })
    startPlayer(state, PLAYER_ID, rng)

    const ship = getShip(state)
    ship.alive = false

    const inputs = seekDestroyAgent(state, PLAYER_ID, createTestContext())

    expect(inputs).toEqual({
      left: false,
      right: false,
      thrust: false,
      fire: false,
    })
  })

  it('returns no-op for unknown player', () => {
    const { state, rng } = createGame({ seed: 'unknown' })
    startPlayer(state, PLAYER_ID, rng)

    const inputs = seekDestroyAgent(state, 'nonexistent', createTestContext())

    expect(inputs).toEqual({
      left: false,
      right: false,
      thrust: false,
      fire: false,
    })
  })

  it('turns toward a rock', () => {
    const { state, rng } = createGame({ seed: 'turn-test' })
    startPlayer(state, PLAYER_ID, rng)

    const ship = getShip(state)

    // Place ship at equator facing north (yaw = 0)
    ship.lat = 0
    ship.lng = 0
    ship.yaw = 0

    // Clear existing rocks and place one to the right (east)
    // 10° longitude at equator = ~0.87 world units — outside danger zone
    state.rocks.clear()
    state.rocks.set('rock-right', mockRock('rock-right', 0, 10))

    const inputs = seekDestroyAgent(state, PLAYER_ID, createTestContext())

    // Rock is to the right, agent should turn right
    expect(inputs.right).toBe(true)
    expect(inputs.left).toBe(false)
  })

  it('fires when aligned with a rock', () => {
    const { state, rng } = createGame({ seed: 'fire-test' })
    startPlayer(state, PLAYER_ID, rng)

    const ship = getShip(state)

    // Place ship at equator facing north
    ship.lat = 0
    ship.lng = 0
    ship.yaw = 0
    ship.firedAt = null // ensure cooldown is clear

    // Place rock directly ahead (north), outside danger zone
    // 10° latitude = ~0.87 world units
    state.rocks.clear()
    state.rocks.set('rock-ahead', mockRock('rock-ahead', 10, 0))

    const inputs = seekDestroyAgent(state, PLAYER_ID, createTestContext())

    expect(inputs.fire).toBe(true)
    expect(inputs.left).toBe(false)
    expect(inputs.right).toBe(false)
  })

  it('dodges a dangerously close rock', () => {
    const { state, rng } = createGame({ seed: 'dodge-test' })
    startPlayer(state, PLAYER_ID, rng)

    const ship = getShip(state)

    // Place ship at equator facing north
    ship.lat = 0
    ship.lng = 0
    ship.yaw = 0

    // Place rock very close — 2° longitude at equator = ~0.175 world units
    state.rocks.clear()
    state.rocks.set('danger-rock', mockRock('danger-rock', 0, 2))

    const inputs = seekDestroyAgent(state, PLAYER_ID, createTestContext())

    // Danger override: rock is to the east (positive relative bearing from
    // north-facing ship), so agent turns left to flee and thrusts out.
    expect(inputs.thrust).toBe(true)
    expect(inputs.left).toBe(true)
    expect(inputs.right).toBe(false)
  })

  it('selects rock with less rotational distance', () => {
    const { state, rng } = createGame({ seed: 'target-select' })
    startPlayer(state, PLAYER_ID, rng)

    const ship = getShip(state)

    // Place ship at equator facing north
    ship.lat = 0
    ship.lng = 0
    ship.yaw = 0

    state.rocks.clear()

    // Rock A: behind (south, ~1.05 units) — outside danger zone
    state.rocks.set('rock-behind', mockRock('rock-behind', -12, 0))

    // Rock B: ahead (north, ~1.22 units) — outside danger zone
    state.rocks.set('rock-ahead', mockRock('rock-ahead', 14, 0))

    const inputs = seekDestroyAgent(state, PLAYER_ID, createTestContext())

    // Should not be turning — the ahead rock has less rotational distance
    expect(inputs.left).toBe(false)
    expect(inputs.right).toBe(false)
  })

  it('achieves non-zero score in simulation', () => {
    const metrics = simulateGame(seekDestroyAgent, { maxTicks: 1000 }, 'perf-1')

    expect(metrics.rocksDestroyed).toBeGreaterThan(0)
    expect(metrics.score).toBeGreaterThan(0)
    expect(metrics.shotsFired).toBeGreaterThan(0)
  })
})
