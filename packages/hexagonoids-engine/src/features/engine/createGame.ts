import { createRNG, type RNG } from '@neat-evolution/utils'

import { defaultGameState } from './defaults.js'
import type { EngineOptions, GameState } from './types.js'

export function createGame(options?: EngineOptions): {
  state: GameState
  rng: RNG
} {
  const rng = createRNG(options?.seed)
  const state: GameState = {
    ...defaultGameState,
    ships: new Map(),
    rocks: new Map(),
    bullets: new Map(),
    players: new Map(),
    mode: options?.mode ?? 'single',
  }
  return { state, rng }
}
