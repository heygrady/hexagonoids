import type { RNG } from '@neat-evolution/utils'
import { type Accessor, createSignal } from 'solid-js'
import { createStore, produce } from 'solid-js/store'

import { createGame } from '../engine/createGame.js'
import type { EngineHooks } from '../engine/hooks.js'
import { step } from '../engine/step.js'
import type { EngineOptions, GameState, PlayerInputs } from '../engine/types.js'

export interface ReactiveEngine {
  state: GameState
  tick: (inputs: PlayerInputs, dt: number) => void
  mutate: (fn: (draft: GameState) => void) => void
  rng: RNG
  shipIds: Accessor<string[]>
  rockIds: Accessor<string[]>
  bulletIds: Accessor<string[]>
  playerIds: Accessor<string[]>
}

export function createReactiveEngine(
  options?: EngineOptions,
  hooks?: EngineHooks
): ReactiveEngine {
  const { state: initialState, rng } = createGame(options)
  const [state, setState] = createStore(initialState)

  // SolidJS stores don't track Map mutations, so we maintain
  // separate signals for entity id lists
  const [shipIds, setShipIds] = createSignal<string[]>([])
  const [rockIds, setRockIds] = createSignal<string[]>([])
  const [bulletIds, setBulletIds] = createSignal<string[]>([])
  const [playerIds, setPlayerIds] = createSignal<string[]>([])

  // Safe to read Map keys from the store proxy after produce() completes:
  // Maps are passed by reference inside the SolidJS store, so the proxy
  // always points to the same Map object that produce() mutated. The keys
  // are read after produce() returns, so they reflect the final state.
  function syncPoolSignals() {
    setShipIds(Array.from(state.ships.keys()))
    setRockIds(Array.from(state.rocks.keys()))
    setBulletIds(Array.from(state.bullets.keys()))
    setPlayerIds(Array.from(state.players.keys()))
  }

  function tick(inputs: PlayerInputs, dt: number) {
    setState(
      produce((draft) => {
        step(draft, inputs, dt, rng, hooks)
      })
    )
    syncPoolSignals()
  }

  /**
   * Apply arbitrary state mutations outside the tick loop (e.g. startPlayer,
   * spawnRock). Always use engine action functions inside the callback —
   * avoid direct Map manipulation, which bypasses setter guards, EngineHooks,
   * and entity invariants.
   */
  function mutate(fn: (draft: GameState) => void) {
    setState(produce(fn))
    syncPoolSignals()
  }

  return { state, tick, mutate, rng, shipIds, rockIds, bulletIds, playerIds }
}
