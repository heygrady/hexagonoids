import type { Mesh } from '@babylonjs/core/Meshes/mesh'
import type { Scene } from '@babylonjs/core/scene'

import { CELL_CACHE_SIZE, CELL_VISITED_OPACITY } from '../../constants'
import { ObjectPool } from '../../pool'
import {
  createCellStore,
  type CellStore,
  defaultCellState,
} from '../cell/CellStore'

/**
 * Reset a cell for pooling.
 * Called when releasing back to pool.
 * @param {CellStore} $cell - Cell store to reset
 * @returns {CellStore} Same cell store
 */
const resetCell = ($cell: CellStore): CellStore => {
  const { originNode, cellNode, h } = $cell.get()

  // 1. Hide/Disable nodes
  if (cellNode != null) {
    cellNode.isVisible = false
    // reset the alpha
    if (cellNode.material != null) {
      cellNode.material.alpha = CELL_VISITED_OPACITY
    }
  }
  if (originNode != null) {
    originNode.setEnabled(false)
  }

  // 2. Validate nodes aren't disposed
  if (cellNode?.isDisposed() === true) {
    console.warn(
      `[CellPool] Cell ${h} has disposed cellNode, clearing reference`
    )
    $cell.setKey('cellNode', null)
  }
  if (originNode?.isDisposed() === true) {
    console.warn(
      `[CellPool] Cell ${h} has disposed originNode, clearing reference`
    )
    $cell.setKey('originNode', null)
  }

  // 3. Reset state (preserve h and nodes)
  $cell.set({ ...defaultCellState, h, originNode, cellNode })

  return $cell
}

/**
 * Dispose of a cell's Babylon.js resources.
 * Called during pool eviction.
 * @param {CellStore} $cell - Cell store to dispose
 */
const disposeCellNodes = ($cell: CellStore): void => {
  const { originNode, positionNode, cellNode } = $cell.get()

  // inside out
  cellNode?.material?.dispose(true, true)
  cellNode?.dispose(false, true)
  positionNode?.dispose()
  originNode?.dispose()

  // Clear references
  $cell.setKey('cellNode', null)
  $cell.setKey('positionNode', null)
  $cell.setKey('originNode', null)
}

/**
 * Cell pool using ObjectPool.
 */
type CellPool = ObjectPool<CellStore>

/**
 * Global cell pool instance.
 */
let globalCellPool: CellPool | null = null

/**
 * Initialize the global cell pool.
 * @param {Scene} scene - Babylon.js scene
 * @param {Mesh} _globe - Globe mesh (unused, kept for consistency)
 */
export const initializeCellPool = (scene: Scene, _globe: Mesh): void => {
  if (globalCellPool !== null) {
    console.warn('[CellPool] Already initialized, skipping')
    return
  }

  globalCellPool = new ObjectPool<CellStore>({
    maxSize: CELL_CACHE_SIZE,
    getScene: () => scene,
    name: 'CellPool',
    createFn: () => createCellStore(),
    resetFn: resetCell,
    disposeFn: disposeCellNodes,
    keyFn: ($cell) => $cell.get().h ?? 'unknown',
  })

  console.debug('[CellPool] Initialized')
}

/**
 * Retrieve a cell from the pool, or create a new one.
 * @param {string} h - Hexagon ID
 * @returns {CellStore} Cell store
 */
export const getCellStore = (h: string): CellStore => {
  if (globalCellPool === null) {
    throw new Error(
      '[CellPool] Not initialized - call initializeCellPool(scene, globe) first'
    )
  }

  // Try to get existing cell for this h, or get any recycled cell
  // Note: The original code used `cellPool.get(h)` which implies it was caching by `h`.
  // But `ObjectPool` is an LRU of *unused* objects.
  // If we want to retrieve a SPECIFIC cell that was previously released, we can try `acquire(h)`.
  // However, usually when we release a cell, it's because it's off-screen or destroyed.
  // When we need a cell for `h`, we just want *any* cell and assign `h` to it.
  // BUT, `createCellStore` takes `h` as an argument in the old code.
  // And `resetCell` preserves `h`.

  // If we want to reuse a cell structure for the SAME `h` if it exists in the pool, we can pass `h` to `acquire`.
  // But `ObjectPool` keys are based on the object's ID (which is `h` here).
  // So if we release a cell with `h='123'`, it goes into the pool with key `'123'`.
  // If we later call `acquire('123')`, we get that specific cell back.
  // This is good! It preserves the identity if possible.

  // However, if '123' is NOT in the pool (it's active or evicted), `acquire('123')` returns undefined (or creates new if we modified `acquire` to take a key).
  // `ObjectPool.acquire(key?)` DOES take a key.
  // If key is provided and exists, it returns that item.
  // If key is NOT provided or NOT exists, it returns the oldest item (LRU).

  // So we should try `acquire(h)`.
  // If we get a recycled cell (that had a different `h`), we need to update its `h`.

  const $cell = globalCellPool.acquire(h)

  // If the acquired cell has a different h (recycled), update it.
  if ($cell.get().h !== h) {
    $cell.setKey('h', h)
  }

  return $cell
}

/**
 * Release a cell back into the pool.
 * @param {CellStore} $cell - Cell store to release
 */
export const releaseCellStore = ($cell: CellStore): void => {
  if (globalCellPool === null) {
    throw new Error('[CellPool] Cannot release cell: pool not initialized')
  }
  globalCellPool.release($cell)
}

/**
 * Destroy the cell pool.
 */
export const destroyCellPool = (): void => {
  if (globalCellPool !== null) {
    globalCellPool.destroy()
    globalCellPool = null
  }
}

/**
 * Get cell pool statistics.
 * @returns {object | null} Pool statistics or null if not initialized
 */
export const getCellPoolStats = () => {
  return globalCellPool?.getStats() ?? null
}

/**
 * DEPRECATED - Legacy disposal.
 * @param {CellStore} $cell - Cell store to dispose
 */
export const disposeCell = ($cell: CellStore): void => {
  console.warn('[CellPool] disposeCell() is deprecated, use releaseCellStore()')
  releaseCellStore($cell)
}
