import { describe, expect, it } from 'vitest'

import {
  advanceGameTime,
  createGame,
  defaultGameState,
  defaultPlayerState,
  defaultRockState,
  defaultShipState,
  elapsed,
  PLAYER_STARTING_LIVES,
  ROCK_LARGE_SIZE,
  ROCK_LARGE_VALUE,
} from '../../src/index.js'

describe('createGame', () => {
  it('returns a valid GameState with correct defaults', () => {
    const { state } = createGame()

    expect(state.now).toBe(0)
    expect(state.wave).toBe(0)
    expect(state.mode).toBe('single')
    expect(state.startedAt).toBeNull()
    expect(state.endedAt).toBeNull()
    expect(state.ships).toBeInstanceOf(Map)
    expect(state.rocks).toBeInstanceOf(Map)
    expect(state.bullets).toBeInstanceOf(Map)
    expect(state.players).toBeInstanceOf(Map)
    expect(state.ships.size).toBe(0)
  })

  it('accepts mode option', () => {
    const { state } = createGame({ mode: 'arena' })
    expect(state.mode).toBe('arena')
  })

  it('accepts seed option', () => {
    const { rng: rng1 } = createGame({ seed: 'test-seed' })
    const { rng: rng2 } = createGame({ seed: 'test-seed' })

    expect(rng1.gen()).toBe(rng2.gen())
  })

  it('creates independent state objects per call', () => {
    const { state: a } = createGame()
    const { state: b } = createGame()

    a.ships.set('s1', { ...defaultShipState, id: 's1', playerId: 'p1' })
    expect(b.ships.size).toBe(0)
  })
})

describe('defaults', () => {
  it('defaultGameState has empty maps', () => {
    expect(defaultGameState.ships.size).toBe(0)
    expect(defaultGameState.rocks.size).toBe(0)
    expect(defaultGameState.bullets.size).toBe(0)
    expect(defaultGameState.players.size).toBe(0)
  })

  it('defaultPlayerState has correct starting values', () => {
    expect(defaultPlayerState.alive).toBe(true)
    expect(defaultPlayerState.score).toBe(0)
    expect(defaultPlayerState.lives).toBe(PLAYER_STARTING_LIVES)
  })

  it('defaultShipState has zero velocity', () => {
    expect(defaultShipState.angularVelocity.length()).toBe(0)
    expect(defaultShipState.yaw).toBe(0)
    expect(defaultShipState.alive).toBe(true)
  })

  it('defaultRockState defaults to large size and value', () => {
    expect(defaultRockState.size).toBe(ROCK_LARGE_SIZE)
    expect(defaultRockState.value).toBe(ROCK_LARGE_VALUE)
  })
})

describe('gameTime', () => {
  it('advanceGameTime increments now by dt in seconds', () => {
    const { state } = createGame()
    advanceGameTime(state, 1 / 60)
    expect(state.now).toBeCloseTo(1000 / 60)
  })

  it('elapsed returns Infinity for null timestamps', () => {
    const { state } = createGame()
    expect(elapsed(state, null)).toBe(Infinity)
  })

  it('elapsed returns correct ms since timestamp', () => {
    const { state } = createGame()
    state.now = 5000
    expect(elapsed(state, 3000)).toBe(2000)
  })
})
