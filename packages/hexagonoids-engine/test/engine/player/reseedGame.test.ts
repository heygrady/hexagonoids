import { createRNG } from '@neat-evolution/utils'
import { beforeEach, describe, expect, it } from 'vitest'

import {
  createGame,
  reseedGame,
  resetIdCounter,
  startPlayer,
} from '../../../src/index.js'

describe('reseedGame', () => {
  beforeEach(() => {
    resetIdCounter()
  })

  it('clears all entity maps and resets state fields', () => {
    const { state, rng } = createGame({ seed: 'test' })
    startPlayer(state, 'p1', rng)

    // Verify entities exist before reseed
    expect(state.ships.size).toBeGreaterThan(0)
    expect(state.players.size).toBeGreaterThan(0)

    const freshRng = createRNG('new-seed')
    reseedGame(state, 'p1', freshRng)

    // After reseed, all old entities are gone but new player/ship exist
    // reseedGame calls startPlayer, so ships/players will have 1 each
    expect(state.rocks.size).toBe(0)
    expect(state.bullets.size).toBe(0)
    expect(state.wave).toBe(0)
    expect(state.now).toBe(0)
    expect(state.startedAt).toBeNull()
    expect(state.endedAt).toBeNull()
  })

  it('starts a player after clearing state', () => {
    const { state } = createGame({ seed: 'test' })
    const freshRng = createRNG('seed-a')

    reseedGame(state, 'player-1', freshRng)

    expect(state.players.size).toBe(1)
    expect(state.players.has('player-1')).toBe(true)
    expect(state.ships.size).toBe(1)
  })

  it('resets ID counter for deterministic entity IDs', () => {
    const { state } = createGame({ seed: 'test' })
    const rng1 = createRNG('seed-x')

    reseedGame(state, 'p1', rng1)
    const firstShipId = Array.from(state.ships.keys())[0]

    // Reseed again — should produce the same ID because counter was reset
    const rng2 = createRNG('seed-y')
    reseedGame(state, 'p1', rng2)
    const secondShipId = Array.from(state.ships.keys())[0]

    expect(firstShipId).toBe(secondShipId)
  })
})
