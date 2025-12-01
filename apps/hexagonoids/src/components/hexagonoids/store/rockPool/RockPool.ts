import { Quaternion } from '@babylonjs/core/Maths/math.vector'
import type { Mesh } from '@babylonjs/core/Meshes/mesh'
import type { Scene } from '@babylonjs/core/scene'

import { ROCK_CACHE_SIZE } from '../../constants'
import { ObjectPool } from '../../pool'
import {
  createRockStore,
  type RockStore,
  defaultRockState,
} from '../rock/RockStore'

/**
 * Reset a rock for pooling.
 * Called when releasing back to pool.
 * @param {RockStore} $rock - Rock store to reset
 * @returns {RockStore} Same rock store
 */
const resetRock = ($rock: RockStore): RockStore => {
  const { id, originNode, orientationNode, rockNode } = $rock.get()

  // 1. Hide/Disable nodes
  if (rockNode != null) {
    rockNode.isVisible = false
  }
  if (originNode != null) {
    originNode.setEnabled(false)
    originNode.rotationQuaternion = Quaternion.Identity()
  }
  if (orientationNode != null) {
    orientationNode.rotationQuaternion = Quaternion.Identity()
  }

  // 2. Validate nodes aren't disposed
  if (rockNode?.isDisposed() === true) {
    console.warn(
      `[RockPool] Rock ${id} has disposed rockNode, clearing reference`
    )
    $rock.setKey('rockNode', null)
  }
  if (originNode?.isDisposed() === true) {
    console.warn(
      `[RockPool] Rock ${id} has disposed originNode, clearing reference`
    )
    $rock.setKey('originNode', null)
  }
  if (orientationNode?.isDisposed() === true) {
    console.warn(
      `[RockPool] Rock ${id} has disposed orientationNode, clearing reference`
    )
    $rock.setKey('orientationNode', null)
  }

  // 3. Reset state (preserve id and nodes)
  $rock.set({ ...defaultRockState, id, originNode, orientationNode, rockNode })

  return $rock
}

/**
 * Dispose of a rock''s Babylon.js resources.
 * Called during pool eviction.
 * @param {RockStore} $rock - Rock store to dispose
 */
const disposeRockNodes = ($rock: RockStore): void => {
  const { originNode, orientationNode, rockNode } = $rock.get()

  // inside out
  rockNode?.material?.dispose(true, true)
  rockNode?.dispose(false, true)
  orientationNode?.dispose()
  originNode?.dispose()

  // Clear references
  $rock.setKey('rockNode', null)
  $rock.setKey('orientationNode', null)
  $rock.setKey('originNode', null)
}

/**
 * Rock pool using ObjectPool.
 */
type RockPool = ObjectPool<RockStore>

/**
 * Global rock pool instance.
 */
let globalRockPool: RockPool | null = null

/**
 * Initialize the global rock pool.
 * @param {Scene} scene - Babylon.js scene
 * @param {Mesh} _globe - Globe mesh (unused, kept for consistency)
 */
export const initializeRockPool = (scene: Scene, _globe: Mesh): void => {
  if (globalRockPool !== null) {
    console.warn('[RockPool] Already initialized, skipping')
    return
  }

  globalRockPool = new ObjectPool<RockStore>({
    maxSize: ROCK_CACHE_SIZE,
    getScene: () => scene,
    name: 'RockPool',
    createFn: () => {
      // createRockStore handles ID generation internally
      return createRockStore()
    },
    resetFn: resetRock,
    disposeFn: disposeRockNodes,
    keyFn: ($rock) => $rock.get().id ?? 'unknown',
  })

  console.debug('[RockPool] Initialized')
}

/**
 * Retrieve a rock from the pool, or create a new one.
 * @returns {RockStore} Rock store
 */
export const getRockStore = (): RockStore => {
  if (globalRockPool === null) {
    throw new Error(
      '[RockPool] Not initialized - call initializeRockPool(scene, globe) first'
    )
  }
  const $rock = globalRockPool.acquire()

  return $rock
}

/**
 * Release a rock back into the pool.
 * @param {RockStore} $rock - Rock store to release
 */
export const releaseRockStore = ($rock: RockStore): void => {
  if (globalRockPool === null) {
    throw new Error('[RockPool] Cannot release rock: pool not initialized')
  }
  globalRockPool.release($rock)
}

/**
 * Destroy the rock pool.
 */
export const destroyRockPool = (): void => {
  if (globalRockPool !== null) {
    globalRockPool.destroy()
    globalRockPool = null
  }
}

/**
 * Get rock pool statistics.
 * @returns {object | null} Pool statistics or null if not initialized
 */
export const getRockPoolStats = () => {
  return globalRockPool?.getStats() ?? null
}
