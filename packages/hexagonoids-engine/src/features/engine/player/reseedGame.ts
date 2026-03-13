import type { RNG } from '@neat-evolution/utils'

import { resetIdCounter } from '../generateId.js'
import type { GameState } from '../types.js'

import { startPlayer } from './playerActions.js'

/**
 * Reset all game state with a new RNG seed.
 * Like restartGame but also resets `now` to 0 and the ID counter
 * for deterministic replay across benchmark sessions.
 */
export function reseedGame(state: GameState, playerId: string, rng: RNG): void {
  // Clear all entities
  state.ships.clear()
  state.rocks.clear()
  state.bullets.clear()
  state.players.clear()

  // Reset game state
  state.wave = 0
  state.now = 0
  state.startedAt = null
  state.endedAt = null

  // Reset ID counter for deterministic entity IDs
  resetIdCounter()

  // Start fresh
  startPlayer(state, playerId, rng)
}
