import { map, type MapStore } from 'nanostores'

import type { CellRecord } from './CellPoolState'

export type CellPoolStore = MapStore<CellRecord>

export const createCellPoolStore = (): CellPoolStore => {
  const $cells = map<CellRecord>({})
  return $cells
}
