import { useStore } from '@nanostores/solid'

import type { ShipPoolActions } from '../store/shipPool/ShipPoolActions'
import type { ShipPoolStore } from '../store/shipPool/ShipPoolStore'

import { useGame } from './useGame'

export const useShipPool = (): [
  $ships: ShipPoolStore,
  actions: ShipPoolActions,
] => {
  const [$game, gameActions] = useGame()
  const { $ships } = $game.get()
  return [$ships, gameActions.ships]
}

export const subscribeShipPool = () => {
  const [$ships] = useShipPool()
  return useStore($ships)
}
