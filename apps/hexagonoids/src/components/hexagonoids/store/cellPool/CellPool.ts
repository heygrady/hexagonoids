import QuickLRU from 'quick-lru'

import { CELL_CACHE_SIZE } from '../../constants'
import { createCellStore, type CellStore, resetCell } from '../cell/CellStore'

export const cellPool = new QuickLRU<string, CellStore>({
  maxSize: CELL_CACHE_SIZE,
  onEviction(key, $cell) {
    // console.log('evicting cell', key)
    disposeCell($cell)
  },
})

/**
 * Retrieve a cell from the pool, or create a new one.
 * @param h
 * @returns
 */
export const getCellStore = (h: string) => {
  // get or create
  const $cell = cellPool.get(h) ?? createCellStore(h)

  // remove from pool
  if (cellPool.has(h)) {
    cellPool.delete(h)
  }

  return $cell
}

/**
 * Release a cell back into the pool.
 * @param $cell
 */
export const releaseCellStore = ($cell: CellStore) => {
  const { h } = $cell.get()
  cellPool.set(h, resetCell($cell))
}

/**
 * Dispose of a cell.
 * @param $cell the cell to dispose
 */
export const disposeCell = ($cell: CellStore) => {
  const { originNode, positionNode, cellNode } = $cell.get()

  // inside out
  cellNode?.material?.dispose(true, true)
  cellNode?.dispose(false, true)
  positionNode?.dispose()
  originNode?.dispose()
}
