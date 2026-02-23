import { describe, expect, it } from 'vitest'
import type { PlayerState } from '../../../src/index.js'
import {
  decrementLives,
  defaultPlayerState,
  incrementScore,
  PLAYER_STARTING_LIVES,
  setLives,
  setScore,
} from '../../../src/index.js'

function createPlayer(overrides: Partial<PlayerState> = {}): PlayerState {
  return {
    ...defaultPlayerState,
    id: 'p1',
    ...overrides,
  }
}

describe('playerSetters', () => {
  describe('setScore', () => {
    it('sets score on an alive player', () => {
      const player = createPlayer()
      const changed = setScore(player, 100)

      expect(changed).toBe(true)
      expect(player.score).toBe(100)
    })

    it('returns false when player is dead', () => {
      const player = createPlayer({ alive: false })
      const changed = setScore(player, 100)

      expect(changed).toBe(false)
      expect(player.score).toBe(0)
    })

    it('returns false for negative score', () => {
      const player = createPlayer()
      const changed = setScore(player, -10)

      expect(changed).toBe(false)
      expect(player.score).toBe(0)
    })
  })

  describe('incrementScore', () => {
    it('adds delta to existing score', () => {
      const player = createPlayer({ score: 50 })
      const changed = incrementScore(player, 25)

      expect(changed).toBe(true)
      expect(player.score).toBe(75)
    })

    it('returns false for zero delta', () => {
      const player = createPlayer({ score: 50 })
      const changed = incrementScore(player, 0)

      expect(changed).toBe(false)
      expect(player.score).toBe(50)
    })
  })

  describe('setLives', () => {
    it('sets lives to a valid value', () => {
      const player = createPlayer()
      const changed = setLives(player, 5)

      expect(changed).toBe(true)
      expect(player.lives).toBe(5)
    })

    it('returns false for negative lives', () => {
      const player = createPlayer()
      const changed = setLives(player, -1)

      expect(changed).toBe(false)
      expect(player.lives).toBe(PLAYER_STARTING_LIVES)
    })
  })

  describe('decrementLives', () => {
    it('decrements lives by default amount', () => {
      const player = createPlayer({ lives: 3 })
      const changed = decrementLives(player)

      expect(changed).toBe(true)
      expect(player.lives).toBe(2)
    })

    it('returns false when decrement would go below zero', () => {
      const player = createPlayer({ lives: 0 })
      const changed = decrementLives(player)

      expect(changed).toBe(false)
      expect(player.lives).toBe(0)
    })
  })
})
