import { describe, expect, it } from 'vitest'

import {
  advanceGameTime,
  createGame,
  defaultShipState,
  elapsed,
} from '../../src/index.js'

describe('createGame', () => {
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
