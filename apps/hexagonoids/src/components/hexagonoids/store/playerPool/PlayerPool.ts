import type { Mesh } from '@babylonjs/core/Meshes/mesh'
import type { Scene } from '@babylonjs/core/scene'

import { ROCK_CACHE_SIZE } from '../../constants'
import { ObjectPool } from '../../pool'
import { resetControl } from '../control/ControlStore'
import {
  createPlayerStore,
  type PlayerStore,
  defaultPlayerState,
} from '../player/PlayerStore'
import { resetShip } from '../ship/ShipStore'

/**
 * Reset a player for pooling.
 * Called when releasing back to pool.
 * @param {PlayerStore} $player - Player store to reset
 * @returns {PlayerStore} Same player store
 */
const resetPlayer = ($player: PlayerStore): PlayerStore => {
  const { id, $ship } = $player.get()

  // Reset ship if it exists
  if ($ship != null) {
    resetShip($ship)
  }

  // Reset state (preserve id and ship)
  $player.set({ ...defaultPlayerState, id, $ship })

  return $player
}

/**
 * Dispose of a player's resources.
 * Called during pool eviction.
 * @param {PlayerStore} $player - Player store to dispose
 */
const disposePlayerResources = ($player: PlayerStore): void => {
  const { $ship } = $player.get()

  // Dispose ship if it exists
  if ($ship != null) {
    const { originNode, positionNode, orientationNode, shipNode, $control } =
      $ship.get()

    shipNode?.material?.dispose(true, true)
    shipNode?.dispose(false, true)
    orientationNode?.dispose()
    positionNode?.dispose()
    originNode?.dispose()

    if ($control != null) {
      resetControl($control)
    }
  }

  // Clear references
  $player.setKey('$ship', null)
}

/**
 * Player pool using ObjectPool.
 */
type PlayerPool = ObjectPool<PlayerStore>

/**
 * Global player pool instance.
 */
let globalPlayerPool: PlayerPool | null = null

/**
 * Initialize the global player pool.
 * @param {Scene} scene - Babylon.js scene
 * @param {Mesh} globe - Globe mesh (unused, kept for consistency)
 */
export const initializePlayerPool = (scene: Scene, globe: Mesh): void => {
  if (globalPlayerPool !== null) {
    console.warn('[PlayerPool] Already initialized, skipping')
    return
  }

  globalPlayerPool = new ObjectPool<PlayerStore>({
    maxSize: ROCK_CACHE_SIZE, // Using ROCK_CACHE_SIZE for now
    getScene: () => scene,
    name: 'PlayerPool',
    createFn: () => createPlayerStore(),
    resetFn: resetPlayer,
    disposeFn: disposePlayerResources,
    keyFn: ($player) => $player.get().id ?? 'unknown',
  })

  console.debug('[PlayerPool] Initialized')
}

/**
 * Retrieve a player from the pool, or create a new one.
 * @returns {PlayerStore} Player store
 */
export const getPlayerStore = (): PlayerStore => {
  if (globalPlayerPool === null) {
    throw new Error(
      '[PlayerPool] Not initialized - call initializePlayerPool(scene, globe) first'
    )
  }
  return globalPlayerPool.acquire()
}

/**
 * Release a player back into the pool.
 * @param {PlayerStore} $player - Player store to release
 */
export const releasePlayerStore = ($player: PlayerStore): void => {
  if (globalPlayerPool === null) {
    throw new Error('[PlayerPool] Cannot release player: pool not initialized')
  }
  globalPlayerPool.release($player)
}

/**
 * Destroy the player pool.
 */
export const destroyPlayerPool = (): void => {
  if (globalPlayerPool !== null) {
    globalPlayerPool.destroy()
    globalPlayerPool = null
  }
}

/**
 * Get player pool statistics.
 * @returns {object | null} Pool statistics or null if not initialized
 */
export const getPlayerPoolStats = () => {
  return globalPlayerPool?.getStats() ?? null
}

/**
 * DEPRECATED - Legacy pool export.
 */
export const playerPool = {
  size: () => globalPlayerPool?.size() ?? 0,
  has: (key: string) => globalPlayerPool?.has(key) ?? false,
  release: ($player: PlayerStore) => {
    releasePlayerStore($player)
  }, // Adapter for legacy calls
}
