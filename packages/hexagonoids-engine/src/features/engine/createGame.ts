import { createRNG, type RNG } from '@neat-evolution/utils'

import {
  createManagedSpatialQueries,
  type ManagedSpatialQueries,
} from './createManagedSpatialQueries.js'
import { defaultGameState } from './defaults.js'
import type { EngineHooks } from './hooks.js'
import { step } from './step.js'
import type { EngineOptions, GameState, PlayerInputs } from './types.js'

export interface EngineInstance extends ManagedSpatialQueries {
  state: GameState
  rng: RNG
  tick: (inputs: PlayerInputs, dtMs: number, hooks?: EngineHooks) => void
  mutate: (fn: (state: GameState) => void) => void
}

export function createGame(options?: EngineOptions): EngineInstance {
  const rng = createRNG(options?.seed)
  const state: GameState = {
    ...defaultGameState,
    ships: new Map(),
    rocks: new Map(),
    bullets: new Map(),
    players: new Map(),
    mode: options?.mode ?? 'single',
    useFastThrust: options?.useFastThrust ?? true,
  }
  const spatialQueries = createManagedSpatialQueries(() => state)

  return {
    state,
    rng,
    tick(inputs: PlayerInputs, dtMs: number, hooks?: EngineHooks): void {
      step(state, inputs, dtMs, rng, hooks, spatialQueries)
    },
    mutate(fn: (draft: GameState) => void): void {
      fn(state)
    },
    ...spatialQueries,
  }
}
