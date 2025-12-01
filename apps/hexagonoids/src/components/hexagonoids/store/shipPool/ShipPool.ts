import { Quaternion } from '@babylonjs/core/Maths/math.vector'
import type { Mesh } from '@babylonjs/core/Meshes/mesh'
import type { Scene } from '@babylonjs/core/scene'

import { ROCK_CACHE_SIZE } from '../../constants'
import { ObjectPool } from '../../pool'
import { resetControl } from '../control/ControlStore'
import {
  createShipStore,
  type ShipStore,
  defaultShipState,
} from '../ship/ShipStore'

/**
 * Reset a ship for pooling.
 * Called when releasing back to pool.
 * @param {ShipStore} $ship - Ship store to reset
 * @returns {ShipStore} Same ship store
 */
const resetShip = ($ship: ShipStore): ShipStore => {
  // preserve the ID, nodes and control store
  const {
    id,
    originNode,
    positionNode,
    orientationNode,
    shipNode,
    shipTailNode,
    $control,
  } = $ship.get()

  // 1. Hide/Disable nodes
  if (shipNode != null) {
    shipNode.isVisible = false
  }
  if (originNode != null) {
    originNode.setEnabled(false)
    originNode.rotationQuaternion = Quaternion.Identity()
  }
  if (orientationNode != null) {
    orientationNode.rotationQuaternion = Quaternion.Identity()
  }

  // 2. Validate nodes aren't disposed
  if (shipNode?.isDisposed() === true) {
    console.warn(
      `[ShipPool] Ship ${id} has disposed shipNode, clearing reference`
    )
    $ship.setKey('shipNode', null)
  }
  if (originNode?.isDisposed() === true) {
    console.warn(
      `[ShipPool] Ship ${id} has disposed originNode, clearing reference`
    )
    $ship.setKey('originNode', null)
  }
  if (positionNode?.isDisposed() === true) {
    console.warn(
      `[ShipPool] Ship ${id} has disposed positionNode, clearing reference`
    )
    $ship.setKey('positionNode', null)
  }
  if (orientationNode?.isDisposed() === true) {
    console.warn(
      `[ShipPool] Ship ${id} has disposed orientationNode, clearing reference`
    )
    $ship.setKey('orientationNode', null)
  }

  // 3. Reset control store
  if ($control != null) {
    resetControl($control)
  }

  // 4. Reset state (preserve id, nodes, and control)
  $ship.set({
    ...defaultShipState,
    id,
    originNode,
    positionNode,
    orientationNode,
    shipNode,
    shipTailNode,
    $control,
  })

  return $ship
}

/**
 * Dispose of a ship's Babylon.js resources.
 * Called during pool eviction.
 * @param {ShipStore} $ship - Ship store to dispose
 */
const disposeShipNodes = ($ship: ShipStore): void => {
  const { originNode, positionNode, orientationNode, shipNode } = $ship.get()

  // inside out
  shipNode?.material?.dispose(true, true)
  shipNode?.dispose(false, true)
  orientationNode?.dispose()
  positionNode?.dispose()
  originNode?.dispose()

  // Clear references
  $ship.setKey('shipNode', null)
  $ship.setKey('orientationNode', null)
  $ship.setKey('positionNode', null)
  $ship.setKey('originNode', null)
}

/**
 * Ship pool using ObjectPool.
 */
type ShipPool = ObjectPool<ShipStore>

/**
 * Global ship pool instance.
 */
let globalShipPool: ShipPool | null = null

/**
 * Initialize the global ship pool.
 * @param {Scene} scene - Babylon.js scene
 * @param {Mesh} _globe - Globe mesh (unused, kept for consistency)
 */
export const initializeShipPool = (scene: Scene, _globe: Mesh): void => {
  if (globalShipPool !== null) {
    console.warn('[ShipPool] Already initialized, skipping')
    return
  }

  globalShipPool = new ObjectPool<ShipStore>({
    maxSize: ROCK_CACHE_SIZE, // Using ROCK_CACHE_SIZE for now, maybe should have its own constant
    getScene: () => scene,
    name: 'ShipPool',
    createFn: () => createShipStore(),
    resetFn: resetShip,
    disposeFn: disposeShipNodes,
    keyFn: ($ship) => $ship.get().id ?? 'unknown',
  })

  console.debug('[ShipPool] Initialized')
}

/**
 * Retrieve a ship from the pool, or create a new one.
 * @returns {ShipStore} Ship store
 */
export const getShipStore = (): ShipStore => {
  if (globalShipPool === null) {
    throw new Error(
      '[ShipPool] Not initialized - call initializeShipPool(scene, globe) first'
    )
  }
  return globalShipPool.acquire()
}

/**
 * Release a ship back into the pool.
 * @param {ShipStore} $ship - Ship store to release
 */
export const releaseShipStore = ($ship: ShipStore): void => {
  if (globalShipPool === null) {
    throw new Error('[ShipPool] Cannot release ship: pool not initialized')
  }
  globalShipPool.release($ship)
}

/**
 * Destroy the ship pool.
 */
export const destroyShipPool = (): void => {
  if (globalShipPool !== null) {
    globalShipPool.destroy()
    globalShipPool = null
  }
}

/**
 * Get ship pool statistics.
 * @returns {object | null} Pool statistics or null if not initialized
 */
export const getShipPoolStats = () => {
  return globalShipPool?.getStats() ?? null
}
