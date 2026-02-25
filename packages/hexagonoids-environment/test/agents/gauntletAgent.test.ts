import { Vector3 } from '@babylonjs/core/Maths/math.vector.js'
import type { RockState } from '@heygrady/hexagonoids-engine'
import {
  createGame,
  latLngToQuaternion,
  startPlayer,
} from '@heygrady/hexagonoids-engine'
import { createRNG } from '@neat-evolution/utils'
import { describe, expect, it } from 'vitest'
import { gauntletAgent } from '../../src/agents/gauntletAgent.js'
import type { AgentContext } from '../../src/agents/types.js'
import { simulateGame } from '../../src/evaluation/simulateGame.js'

const PLAYER_ID = 'player-1'

function createTestContext(seed = 'test'): AgentContext {
  return { rng: createRNG(seed), memory: {} }
}

function getShip(state: ReturnType<typeof createGame>['state']) {
  const player = state.players.get(PLAYER_ID)
  if (player == null || player.shipId == null) throw new Error('no player')
  const ship = state.ships.get(player.shipId)
  if (ship == null) throw new Error('no ship')
  return ship
}

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

const YAW_NORTH = -Math.PI / 2

describe('gauntletAgent', () => {
  it('returns no-op when ship is dead', () => {
    const { state, rng } = createGame({ seed: 'dead-ship' })
    startPlayer(state, PLAYER_ID, rng)

    const ship = getShip(state)
    ship.alive = false

    const inputs = gauntletAgent(state, PLAYER_ID, createTestContext())

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

    const inputs = gauntletAgent(state, 'nonexistent', createTestContext())

    expect(inputs).toEqual({
      left: false,
      right: false,
      thrust: false,
      fire: false,
    })
  })

  it('fires when aligned with a rock in range', () => {
    const { state, rng } = createGame({ seed: 'fire-test' })
    startPlayer(state, PLAYER_ID, rng)

    const ship = placeShipAtOrigin(state, YAW_NORTH)
    ship.firedAt = null

    // Rock directly ahead (north)
    state.rocks.set('rock-ahead', mockRock('rock-ahead', 10, 0))

    const inputs = gauntletAgent(state, PLAYER_ID, createTestContext())

    expect(inputs.fire).toBe(true)
  })

  it('evades a rock on collision course when ship is moving toward it', () => {
    const { state, rng } = createGame({ seed: 'evade-test' })
    startPlayer(state, PLAYER_ID, rng)

    const ship = placeShipAtOrigin(state, YAW_NORTH)
    ship.firedAt = state.now // cooldown active

    // Ship moving north (toward the rock) — makes trajectory unsafe
    ship.angularVelocity = new Vector3(-0.15, 0, 0)

    // Rock close to the north, also approaching
    state.rocks.set(
      'danger-rock',
      mockRock('danger-rock', 3, 0, 2, new Vector3(-0.2, 0, 0))
    )

    const inputs = gauntletAgent(state, PLAYER_ID, createTestContext())

    // Should turn to dodge — trajectory toward the rock is unsafe
    expect(inputs.left || inputs.right).toBe(true)
    expect(inputs.left && inputs.right).toBe(false)
  })

  it('tracks turn duration in memory', () => {
    const { state, rng } = createGame({ seed: 'memory-test' })
    startPlayer(state, PLAYER_ID, rng)

    placeShipAtOrigin(state, YAW_NORTH)

    // Rock to the east — agent must turn right
    state.rocks.set('rock-east', mockRock('rock-east', 0, 10))

    const ctx = createTestContext()
    gauntletAgent(state, PLAYER_ID, ctx)

    const mem = ctx.memory as Record<string, unknown>
    expect(typeof mem['turnDuration']).toBe('number')
    expect(typeof mem['lastTurnDir']).toBe('number')
  })

  it('achieves non-zero score in simulation', () => {
    const metrics = simulateGame(
      gauntletAgent,
      { maxTicks: 1000 },
      'gauntlet-perf-1'
    )

    expect(metrics.rocksDestroyed).toBeGreaterThan(0)
    expect(metrics.score).toBeGreaterThan(0)
  })
})
