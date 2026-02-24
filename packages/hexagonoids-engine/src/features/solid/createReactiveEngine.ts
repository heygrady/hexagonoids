import type { RNG } from '@neat-evolution/utils'
import { type Accessor, createSignal } from 'solid-js'
import { createStore, produce } from 'solid-js/store'

import { createGame } from '../engine/createGame.js'
import type { EngineHooks } from '../engine/hooks.js'
import { step } from '../engine/step.js'
import type { EngineOptions, GameState, PlayerInputs } from '../engine/types.js'

/** Compare two string arrays for equality by value */
function idsEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false
  }
  return true
}

/** Only update signal if the ID list actually changed */
function syncIds(
  map: Map<string, unknown>,
  getCurrent: Accessor<string[]>,
  setter: (ids: string[]) => void
): void {
  const next = Array.from(map.keys())
  if (!idsEqual(getCurrent(), next)) {
    setter(next)
  }
}

export interface ReactiveEngine {
  state: GameState
  tick: (inputs: PlayerInputs, dtMs: number) => void
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
  //
  // Only triggers SolidJS subscribers when the ID list actually changed,
  // avoiding unnecessary re-renders on ticks where entity pools are stable.
  function syncPoolSignals() {
    syncIds(state.ships, shipIds, setShipIds)
    syncIds(state.rocks, rockIds, setRockIds)
    syncIds(state.bullets, bulletIds, setBulletIds)
    syncIds(state.players, playerIds, setPlayerIds)
  }

  function tick(inputs: PlayerInputs, dtMs: number) {
    setState(
      produce((draft) => {
        step(draft, inputs, dtMs, rng, hooks)
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

  // Initialize signals with any pre-existing entities in the initial state
  syncPoolSignals()

  return { state, tick, mutate, rng, shipIds, rockIds, bulletIds, playerIds }
}
