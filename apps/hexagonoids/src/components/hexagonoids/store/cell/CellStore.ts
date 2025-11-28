import { map, type MapStore } from 'nanostores'

import { CELL_VISITED_OPACITY } from '../../constants'

import { defaultCellState, type CellState } from './CellState'

export { defaultCellState }

export type CellStore = MapStore<CellState>

export const createCellStore = (h?: string): CellStore => {
  const $cell = map<CellState>({ ...defaultCellState })
  if (h != null) {
    $cell.setKey('h', h)
  }
  return $cell
}

/**
 * Prepare the $cell for reuse.
 * @param {CellStore} $cell - The cell store to reset
 * @returns {CellStore} The reset cell store
 */
export const resetCell = ($cell: CellStore) => {
  const { originNode, cellNode } = $cell.get()

  // make invisible
  if (originNode != null && cellNode != null) {
    cellNode.isVisible = false
    originNode.setEnabled(false)

    // reset the alpha
    if (cellNode.material != null) {
      cellNode.material.alpha = CELL_VISITED_OPACITY
    }
  }

  return $cell
}
