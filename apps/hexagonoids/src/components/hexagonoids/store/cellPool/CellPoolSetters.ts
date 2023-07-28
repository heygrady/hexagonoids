import { requestIdleCallback } from 'idle-callback'
import { action } from 'nanostores'
import type { OmitFirstArg } from 'nanostores/action'

import type { CellStore } from '../cell/CellStore'

import { releaseCellStore } from './CellPool'
import type { CellPoolStore } from './CellPoolStore'

interface CellPoolSetters {
  add: OmitFirstArg<typeof addCell>
  remove: OmitFirstArg<typeof removeCell>
  clear: OmitFirstArg<typeof clearCells>
}

export const bindCellPoolSetters = (
  $cellPool: CellPoolStore
): CellPoolSetters => ({
  add: action($cellPool, 'add', addCell),
  remove: action($cellPool, 'remove', removeCell),
  clear: action($cellPool, 'clear', clearCells),
})

export const deferredCallbacks = new Set<number>()

export const deferIdleCallback = (fn: () => void) => {
  const callback = () => {
    deferredCallbacks.delete(callbackId)
    fn()
  }
  const callbackId = requestIdleCallback(callback)
  deferredCallbacks.add(callbackId)
  return callbackId
}

/**
 * Add a cell to the scene
 * @param $cells
 * @param $cell
 */
export const addCell = ($cells: CellPoolStore, $cell: CellStore) => {
  const h = $cell.get().h

  if (h === undefined) {
    throw new Error('Cannot add cell without an h')
  }
  const $prevCell = $cells.get()[h]
  if ($cell !== $prevCell) {
    $cells.setKey(h, $cell)
  }
}

/**
 * Remove a cell from the scene; releases it back to the pool.
 * @param $cells
 * @param $cell
 */
export const removeCell = ($cells: CellPoolStore, $cell: CellStore) => {
  const h = $cell.get().h

  if (h === undefined) {
    throw new Error('Cannot remove cell without an h')
  }

  // remove from active rocks
  $cells.setKey(h, undefined)

  // release back into the pool
  releaseCellStore($cell)
}

/**
 * Remove all cells from the scene
 * @param $cells
 */
export const clearCells = ($cells: CellPoolStore) => {
  for (const $cell of Object.values($cells.get())) {
    if ($cell == null) {
      continue
    }
    removeCell($cells, $cell)
  }
}
