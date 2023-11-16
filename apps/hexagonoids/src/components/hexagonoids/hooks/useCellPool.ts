import { useStore } from '@nanostores/solid'

import type { CellPoolActions } from '../store/cellPool/CellPoolActions'
import type { CellPoolStore } from '../store/cellPool/CellPoolStore'

import { useGame } from './useGame'

export const useCellPool = (): [
  $cells: CellPoolStore,
  actions: CellPoolActions,
] => {
  const [$game, gameActions] = useGame()
  const { $cells } = $game.get()
  return [$cells, gameActions.cells]
}

export const subscribeCellPool = () => {
  const [$cells] = useCellPool()
  return useStore($cells)
}
