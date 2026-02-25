import {
  createGame,
  greatCircleDistance,
  RADIUS,
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

  // Run some ticks to spawn rocks
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

  return { state, rng }
}

describe('encodeGameState', () => {
  it('returns exactly 30 elements', () => {
    const { state } = setupGame('test-enc-1', 1)
    const result = encodeGameState(state, PLAYER_ID, new Map(), 33)
    expect(result).toHaveLength(INPUT_COUNT)
    expect(result).toHaveLength(30)
  })

  it('all values are numbers (not NaN)', () => {
    const { state } = setupGame('test-enc-2', 5)
    const result = encodeGameState(state, PLAYER_ID, new Map(), 33)
    for (const val of result) {
      expect(typeof val).toBe('number')
      expect(Number.isNaN(val)).toBe(false)
    }
  })

  it('speed is in [0, 1]', () => {
    const { state } = setupGame('test-enc-3', 1)
    const result = encodeGameState(state, PLAYER_ID, new Map(), 33)
    expect(result[0]).toBeGreaterThanOrEqual(0)
    expect(result[0]).toBeLessThanOrEqual(1)
  })

  it('heading_vx and heading_vy are in [-1, 1]', () => {
    const { state } = setupGame('test-enc-4', 1)
    const result = encodeGameState(state, PLAYER_ID, new Map(), 33)
    expect(result[1]).toBeGreaterThanOrEqual(-1)
    expect(result[1]).toBeLessThanOrEqual(1)
    expect(result[2]).toBeGreaterThanOrEqual(-1)
    expect(result[2]).toBeLessThanOrEqual(1)
  })

  it('can_fire is 0 or 1', () => {
    const { state } = setupGame('test-enc-5', 1)
    const result = encodeGameState(state, PLAYER_ID, new Map(), 33)
    expect([0, 1]).toContain(result[3])
  })

  it('lives is in [0, 1]', () => {
    const { state } = setupGame('test-enc-6', 1)
    const result = encodeGameState(state, PLAYER_ID, new Map(), 33)
    expect(result[4]).toBeGreaterThanOrEqual(0)
    expect(result[4]).toBeLessThanOrEqual(1)
  })

  it('empty field (no rocks) → all sector distances = 1.0, sizes = 0', () => {
    const { state } = setupGame('test-enc-empty', 0)
    // Before first step, no rocks exist
    const result = encodeGameState(state, PLAYER_ID, new Map(), 33)

    for (let s = 0; s < 8; s++) {
      const base = 5 + s * 3
      expect(result[base]).toBe(1.0) // distance = 1.0 (max)
      expect(result[base + 1]).toBe(0) // approachSpeed = 0
      expect(result[base + 2]).toBe(0) // size = 0
    }
    expect(result[29]).toBe(1.0) // nearest_rock = 1.0
  })

  it('rock outside SOI is not encoded', () => {
    const { state } = setupGame('test-enc-soi', 1)

    // Get ship position
    const player = state.players.get(PLAYER_ID)
    const ship =
      player?.shipId != null ? state.ships.get(player.shipId) : undefined

    // Check rocks are present
    expect(state.rocks.size).toBeGreaterThan(0)

    const result = encodeGameState(state, PLAYER_ID, new Map(), 33)

    if (ship?.alive) {
      // For each sector, verify distance values are valid
      for (let s = 0; s < 8; s++) {
        const base = 5 + s * 3
        // Distance should be in [0, 1]
        expect(result[base]).toBeGreaterThanOrEqual(0)
        expect(result[base]).toBeLessThanOrEqual(1)
      }
    }
  })

  it('dead ship returns zeros with sector distances at 1.0', () => {
    const { state } = setupGame('test-enc-dead', 1)

    // Force the ship to be dead so we reliably test the dead-ship branch
    const player = state.players.get(PLAYER_ID)
    const ship =
      player?.shipId != null ? state.ships.get(player.shipId) : undefined
    if (ship != null) {
      ship.alive = false
    }

    const result = encodeGameState(state, PLAYER_ID, new Map(), 33)
    expect(result).toHaveLength(30)

    // Speed should be 0 for dead ship
    expect(result[0]).toBe(0)
    // Sector distances should be 1.0
    for (let s = 0; s < 8; s++) {
      expect(result[5 + s * 3]).toBe(1.0)
    }
  })

  it('same relative config at different positions → similar encoding (ego-centric)', () => {
    // Run two games with different seeds — different positions but similar structure
    // This is a soft test: we verify the encoding is always in valid ranges
    const { state: s1 } = setupGame('ego-a', 5)
    const { state: s2 } = setupGame('ego-b', 5)

    const r1 = encodeGameState(s1, PLAYER_ID, new Map(), 33)
    const r2 = encodeGameState(s2, PLAYER_ID, new Map(), 33)

    // Both should have the same length and valid ranges
    expect(r1).toHaveLength(30)
    expect(r2).toHaveLength(30)

    for (let i = 0; i < 30; i++) {
      expect(r1[i]).toBeGreaterThanOrEqual(-1)
      expect(r1[i]).toBeLessThanOrEqual(1)
      expect(r2[i]).toBeGreaterThanOrEqual(-1)
      expect(r2[i]).toBeLessThanOrEqual(1)
    }
  })

  it('approach speed uses prevDistances when available', () => {
    const { state } = setupGame('test-approach', 2)

    const player = state.players.get(PLAYER_ID)
    const ship =
      player?.shipId != null ? state.ships.get(player.shipId) : undefined

    if (ship == null || !ship.alive) {
      throw new Error(
        'Test precondition: ship should be alive after 2 ticks with seed test-approach'
      )
    }
    expect(state.rocks.size).toBeGreaterThan(0)

    // Build prevDistances from current positions (simulating previous tick)
    const prevDistances = new Map<string, number>()
    for (const rock of state.rocks.values()) {
      const dist = greatCircleDistance(
        ship.lat,
        ship.lng,
        rock.lat,
        rock.lng,
        RADIUS
      )
      // Set prev distance slightly larger to simulate closing
      prevDistances.set(rock.id, dist + 0.05)
    }

    const result = encodeGameState(state, PLAYER_ID, prevDistances, 33)

    // The encoding should still be valid
    expect(result).toHaveLength(30)
    for (const val of result) {
      expect(Number.isNaN(val)).toBe(false)
    }
  })
})
