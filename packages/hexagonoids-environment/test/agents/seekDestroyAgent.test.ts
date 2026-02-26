import { Vector3 } from '@babylonjs/core/Maths/math.vector.js'
import type { RockState } from '@heygrady/hexagonoids-engine'
import {
  createGame,
  latLngToQuaternion,
  startPlayer,
} from '@heygrady/hexagonoids-engine'
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

/** Create a mock rock at given lat/lng with proper Babylon types and consistent orientation. */
function mockRock(
  id: string,
  lat: number,
  lng: number,
  size: 0 | 1 | 2 = 2,
  angularVelocity: Vector3 = Vector3.Zero()
): RockState {
  return {
    id,
    orientation: latLngToQuaternion(lat, lng),
    lat,
    lng,
    angularVelocity,
    size,
    value: size === 2 ? 50 : size === 1 ? 100 : 200,
  }
}

/**
 * Place ship at equator (0, 0) with a specific yaw.
 * Updates orientation, lat, lng, and yaw consistently.
 */
function placeShipAtOrigin(
  state: ReturnType<typeof createGame>['state'],
  yaw: number
) {
  const ship = getShip(state)
  ship.orientation = latLngToQuaternion(0, 0)
  ship.lat = 0
  ship.lng = 0
  ship.yaw = yaw
  ship.angularVelocity = Vector3.Zero()
  state.rocks.clear()
  return ship
}

// Engine convention: yaw 0 = East, -PI/2 = North, PI/2 = South, PI = West
const YAW_NORTH = -Math.PI / 2

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

    // Ship at equator facing North (yaw = -PI/2)
    placeShipAtOrigin(state, YAW_NORTH)

    // Rock to the East (right when facing North)
    state.rocks.set('rock-right', mockRock('rock-right', 0, 10))

    const inputs = seekDestroyAgent(state, PLAYER_ID, createTestContext())

    // Rock is to the right, agent should turn right
    expect(inputs.right).toBe(true)
    expect(inputs.left).toBe(false)
  })

  it('fires when aligned with a rock', () => {
    const { state, rng } = createGame({ seed: 'fire-test' })
    startPlayer(state, PLAYER_ID, rng)

    // Ship at equator facing North
    const ship = placeShipAtOrigin(state, YAW_NORTH)
    ship.firedAt = null // ensure cooldown is clear

    // Rock directly ahead (North)
    state.rocks.set('rock-ahead', mockRock('rock-ahead', 10, 0))

    const inputs = seekDestroyAgent(state, PLAYER_ID, createTestContext())

    expect(inputs.fire).toBe(true)
    expect(inputs.left).toBe(false)
    expect(inputs.right).toBe(false)
  })

  it('dodges a rock on collision course', () => {
    const { state, rng } = createGame({ seed: 'dodge-test' })
    startPlayer(state, PLAYER_ID, rng)

    // Ship at equator facing North
    const ship = placeShipAtOrigin(state, YAW_NORTH)
    ship.firedAt = state.now

    // Rock slightly north, closing south toward ship
    // Angular velocity (-0.2, 0, 0) rotates around -X axis → moves south at equator
    state.rocks.set(
      'danger-rock',
      mockRock('danger-rock', 3, 0, 2, new Vector3(-0.2, 0, 0))
    )

    const inputs = seekDestroyAgent(state, PLAYER_ID, createTestContext())

    // Should evade: turn to dodge, thrust to escape
    expect(inputs.left || inputs.right).toBe(true)
    expect(inputs.left && inputs.right).toBe(false)
    expect(inputs.thrust).toBe(true)
  })

  it('does not evade a stationary non-threatening rock', () => {
    const { state, rng } = createGame({ seed: 'receding-test' })
    startPlayer(state, PLAYER_ID, rng)

    // Ship at equator facing North
    placeShipAtOrigin(state, YAW_NORTH)

    // Stationary rock behind — closingSpeed = 0, TTC = Infinity, no evasion
    state.rocks.set('safe-rock', mockRock('safe-rock', -8, 0))

    const ctx = createTestContext()
    seekDestroyAgent(state, PLAYER_ID, ctx)
    const mem = ctx.memory as Record<string, unknown>

    // Should NOT be in evade mode — rock is not approaching
    expect(mem['mode']).not.toBe('evade')
  })

  it('selects rock with less rotational distance', () => {
    const { state, rng } = createGame({ seed: 'target-select' })
    startPlayer(state, PLAYER_ID, rng)

    // Ship at equator facing North
    placeShipAtOrigin(state, YAW_NORTH)

    // Rock A: behind (south) — in effective range
    state.rocks.set('rock-behind', mockRock('rock-behind', -8, 0))

    // Rock B: ahead (north) — in effective range, less rotational distance
    state.rocks.set('rock-ahead', mockRock('rock-ahead', 8, 0))

    const inputs = seekDestroyAgent(state, PLAYER_ID, createTestContext())

    // Should not be turning — the ahead rock has less rotational distance
    expect(inputs.left).toBe(false)
    expect(inputs.right).toBe(false)
  })

  it('pursues out-of-range targets when nothing is in range', () => {
    const { state, rng } = createGame({ seed: 'out-of-range-pursuit' })
    startPlayer(state, PLAYER_ID, rng)

    // Ship at equator facing North
    placeShipAtOrigin(state, YAW_NORTH)

    // Rock far to the East (~2.6 world units, outside bullet range ~= 1.41)
    state.rocks.set('far-right', mockRock('far-right', 0, 30))

    const inputs = seekDestroyAgent(state, PLAYER_ID, createTestContext())

    expect(inputs.right).toBe(true)
    expect(inputs.left).toBe(false)
  })

  it('fires and manages speed when engaging an aligned rock', () => {
    const { state, rng } = createGame({ seed: 'stately-speed' })
    startPlayer(state, PLAYER_ID, rng)

    // Ship at equator facing North
    const ship = placeShipAtOrigin(state, YAW_NORTH)
    ship.firedAt = null

    // Rock directly ahead (north)
    state.rocks.set('rock-ahead', mockRock('rock-ahead', 10, 0))

    const inputs = seekDestroyAgent(state, PLAYER_ID, createTestContext())

    expect(inputs.fire).toBe(true)
    // Should not turn — rock is straight ahead
    expect(inputs.left).toBe(false)
    expect(inputs.right).toBe(false)
  })

  it('achieves non-zero score in simulation', () => {
    const metrics = simulateGame(seekDestroyAgent, { maxTicks: 3000 }, 'perf-1')

    expect(metrics.rocksDestroyed).toBeGreaterThan(0)
    expect(metrics.score).toBeGreaterThan(0)
    expect(metrics.shotsFired).toBeGreaterThan(0)
  })
})
