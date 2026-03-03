import { createRNG, type RNG } from '@neat-evolution/utils'
import { type Accessor, createSignal } from 'solid-js'
import { createStore, produce } from 'solid-js/store'
import { createGame } from '../engine/createGame.js'
import {
  createManagedSpatialQueries,
  type ManagedSpatialQueries,
} from '../engine/createManagedSpatialQueries.js'
import type { EngineHooks } from '../engine/hooks.js'
import { unitPointToLatLngInPlace } from '../engine/physics/latLng.js'
import { reseedGame } from '../engine/player/reseedGame.js'
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

function syncDerivedLatLng(state: GameState): void {
  for (const ship of state.ships.values()) {
    if (ship.x != null && ship.y != null && ship.z != null) {
      unitPointToLatLngInPlace(ship.x, ship.y, ship.z, ship)
    }
  }
  for (const rock of state.rocks.values()) {
    if (rock.x != null && rock.y != null && rock.z != null) {
      unitPointToLatLngInPlace(rock.x, rock.y, rock.z, rock)
    }
  }
  for (const bullet of state.bullets.values()) {
    if (bullet.x != null && bullet.y != null && bullet.z != null) {
      unitPointToLatLngInPlace(bullet.x, bullet.y, bullet.z, bullet)
    }
  }
}

export interface ReactiveEngine extends ManagedSpatialQueries {
  state: GameState
  tick: (inputs: PlayerInputs, dtMs: number) => void
  mutate: (fn: (draft: GameState) => void) => void
  reseed: (seed: string, playerId: string) => void
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
  const { state: initialState, rng: initialRng } = createGame(options)
  let rng: RNG = initialRng
  const [state, setState] = createStore(initialState)
  const spatialQueries = createManagedSpatialQueries(() => state)

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
        step(draft, inputs, dtMs, rng, hooks, spatialQueries)
        syncDerivedLatLng(draft)
      })
    )
    spatialQueries.invalidateSpatialIndex()
    syncPoolSignals()
  }

  /**
   * Apply arbitrary state mutations outside the tick loop (e.g. startPlayer,
   * spawnRock). Always use engine action functions inside the callback —
   * avoid direct Map manipulation, which bypasses setter guards, EngineHooks,
   * and entity invariants.
   */
  function mutate(fn: (draft: GameState) => void) {
    setState(
      produce((draft) => {
        fn(draft)
        syncDerivedLatLng(draft)
      })
    )
    spatialQueries.invalidateSpatialIndex()
    syncPoolSignals()
  }

  /**
   * Replace the RNG with a new seed and reset all game state.
   * Used by record mode to cycle through benchmark seeds without
   * re-mounting the Babylon scene.
   */
  function reseed(seed: string, playerId: string) {
    rng = createRNG(seed)
    setState(
      produce((draft) => {
        reseedGame(draft, playerId, rng)
        syncDerivedLatLng(draft)
      })
    )
    spatialQueries.invalidateSpatialIndex()
    syncPoolSignals()
  }

  // Initialize signals with any pre-existing entities in the initial state
  syncPoolSignals()

  const engine: ReactiveEngine = {
    state,
    tick,
    mutate,
    reseed,
    get rng() {
      return rng
    },
    shipIds,
    rockIds,
    bulletIds,
    playerIds,
    ...spatialQueries,
  }

  return engine
}
