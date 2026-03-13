import { createRoot } from 'solid-js'
import { beforeEach, describe, expect, it } from 'vitest'
import {
  createReactiveEngine,
  usePlayer,
  usePlayerLives,
  usePlayerScore,
} from '../../src/features/solid/index.js'
import { resetIdCounter, startPlayer } from '../../src/index.js'

describe('playerStore', () => {
  beforeEach(() => {
    resetIdCounter()
  })

  it('usePlayer returns state for a known player', () => {
    createRoot((dispose) => {
      const engine = createReactiveEngine({ seed: 'test' })
      engine.mutate((state) => startPlayer(state, 'p1', engine.rng))

      const player = usePlayer(engine, 'p1')

      expect(player()).toBeDefined()
      expect(player()!.score).toBe(0)
      dispose()
    })
  })

  it('usePlayerScore returns 0 for an unknown player', () => {
    createRoot((dispose) => {
      const engine = createReactiveEngine({ seed: 'test' })
      const score = usePlayerScore(engine, 'nonexistent')

      expect(score()).toBe(0)
      dispose()
    })
  })

  it('usePlayerLives returns 0 for an unknown player', () => {
    createRoot((dispose) => {
      const engine = createReactiveEngine({ seed: 'test' })
      const lives = usePlayerLives(engine, 'nonexistent')

      expect(lives()).toBe(0)
      dispose()
    })
  })

  it('usePlayerLives returns lives for a known player', () => {
    createRoot((dispose) => {
      const engine = createReactiveEngine({ seed: 'test' })
      engine.mutate((state) => startPlayer(state, 'p1', engine.rng))

      const lives = usePlayerLives(engine, 'p1')

      expect(lives()).toBeGreaterThan(0)
      dispose()
    })
  })
})
