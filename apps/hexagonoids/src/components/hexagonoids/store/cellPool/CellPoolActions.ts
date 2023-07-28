import type { Scene } from '@babylonjs/core'
import { action } from 'nanostores'
import type { OmitFirstArg } from 'nanostores/action'

import { generateCell } from '../../cell/generateCell'
import { setImpactedAt, setVisitedAt } from '../cell/CellSetters'

import { getCellStore } from './CellPool'
import { addCell } from './CellPoolSetters'
import type { CellPoolStore } from './CellPoolStore'

export interface CellPoolActions {
  visit: OmitFirstArg<typeof visit>
  impact: OmitFirstArg<typeof impact>
}

export const bindCellPoolActions = (
  $cellPool: CellPoolStore
): CellPoolActions => ({
  visit: action($cellPool, 'visit', visit),
  impact: action($cellPool, 'impact', impact),
})

/**
 * Get a cell from the pool; prep it; add it to the scene
 * @param $cells
 * @param h
 * @param scene
 * @returns
 */
export const getCell = ($cells: CellPoolStore, h: string, scene: Scene) => {
  let $cell = $cells.get()[h]

  if ($cell != null) {
    return $cell
  }

  // remove from the pool
  $cell = getCellStore(h)

  // initialize vlaues
  generateCell($cell, scene)

  // add it to the scene
  addCell($cells, $cell)

  const { originNode, cellNode } = $cell.get()

  // make it visible
  if (originNode != null && cellNode != null) {
    cellNode.isVisible = true
    originNode.setEnabled(true)
  }
  return $cell
}

export const impact = ($cells: CellPoolStore, h: string, scene: Scene) => {
  const $cell = getCell($cells, h, scene)
  setImpactedAt($cell)
  return $cell
}

export const visit = (
  $cells: CellPoolStore,
  h: string,
  scene: Scene,
  now?: number
) => {
  const $cell = getCell($cells, h, scene)
  setVisitedAt($cell, now)
  return $cell
}
