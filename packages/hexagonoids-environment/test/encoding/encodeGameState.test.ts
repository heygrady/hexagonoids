import {
  createGame,
  greatCircleDistance,
  RADIUS,
  ROCK_LARGE_SIZE,
  spawnRock,
  startPlayer,
  step,
} from '@heygrady/hexagonoids-engine'
import { describe, expect, it } from 'vitest'
import {
  encodeGameState,
  INPUT_COUNT,
} from '../../src/encoding/encodeGameState.js'

const PLAYER_ID = 'player-1'

function setupGame(seed: string, ticks = 0) {
  const { state, rng } = createGame({ seed })
  startPlayer(state, PLAYER_ID, rng)

  for (let i = 0; i < ticks; i++) {
    step(
      state,
      {
        [PLAYER_ID]: { thrust: false, fire: false, left: false, right: false },
      },
      33,
      rng
    )
  }

  return { state }
}

describe('encodeGameState', () => {
  it('returns exactly the configured input count', () => {
    const { state } = setupGame('enc-v2-length', 5)
    const result = encodeGameState(state, PLAYER_ID, new Map(), 33)
    expect(result).toHaveLength(INPUT_COUNT)
    expect(result).toHaveLength(133)
  })

  it('returns all finite numbers', () => {
    const { state } = setupGame('enc-v2-finite', 15)
    const result = encodeGameState(state, PLAYER_ID, new Map(), 33)
    for (const value of result) {
      expect(Number.isFinite(value)).toBe(true)
    }
  })

  it('global features are normalized to expected ranges', () => {
    const { state } = setupGame('enc-v2-ranges', 20)
    const result = encodeGameState(state, PLAYER_ID, new Map(), 33)

    expect(result[0]).toBeGreaterThanOrEqual(0)
    expect(result[0]).toBeLessThanOrEqual(1)

    expect(result[1]).toBeGreaterThanOrEqual(-1)
    expect(result[1]).toBeLessThanOrEqual(1)
    expect(result[2]).toBeGreaterThanOrEqual(-1)
    expect(result[2]).toBeLessThanOrEqual(1)

    expect(result[3]).toBeGreaterThanOrEqual(0)
    expect(result[3]).toBeLessThanOrEqual(1)
    expect(result[4]).toBeGreaterThanOrEqual(0)
    expect(result[4]).toBeLessThanOrEqual(1)
  })

  it('when no rocks are nearby, lidar slots remain zeroed', () => {
    const { state } = setupGame('enc-v2-empty', 0)
    const result = encodeGameState(state, PLAYER_ID, new Map(), 33)

    for (let i = 5; i < result.length; i++) {
      expect(result[i]).toBe(0)
    }
  })

  it('dead ship returns stable fallback vector shape', () => {
    const { state } = setupGame('enc-v2-dead', 1)
    const player = state.players.get(PLAYER_ID)
    const ship =
      player?.shipId != null ? state.ships.get(player.shipId) : undefined
    if (ship != null) ship.alive = false

    const result = encodeGameState(state, PLAYER_ID, new Map(), 33)

    expect(result).toHaveLength(INPUT_COUNT)
    expect(result[0]).toBe(0)
    expect(result[3]).toBe(0)
  })

  it('uses previous distances to produce non-zero closing features', () => {
    const { state } = setupGame('enc-v2-closing', 5)
    const player = state.players.get(PLAYER_ID)
    const ship =
      player?.shipId != null ? state.ships.get(player.shipId) : undefined
    if (ship == null || !ship.alive) {
      throw new Error('Expected alive ship for closing-speed test')
    }

    // Force at least one local rock in SOI so closing features are populated.
    spawnRock(state, ship.lat, ship.lng + 4, ROCK_LARGE_SIZE, {
      gen: () => 0.5,
      genRange: (min: number, _max: number) => min,
      genBool: () => true,
    })

    const prevDistances = new Map<string, number>()
    for (const rock of state.rocks.values()) {
      const dist = greatCircleDistance(
        ship.lat,
        ship.lng,
        rock.lat,
        rock.lng,
        RADIUS
      )
      prevDistances.set(`rock:${rock.id}`, dist + 0.08)
    }

    const result = encodeGameState(state, PLAYER_ID, prevDistances, 33)

    const closingFeatures: number[] = []
    for (let ray = 0; ray < 32; ray++) {
      const base = 5 + ray * 4
      closingFeatures.push(result[base + 1] ?? 0)
    }
    expect(closingFeatures.some((v) => Math.abs(v) > 0.0001)).toBe(true)
  })
})
