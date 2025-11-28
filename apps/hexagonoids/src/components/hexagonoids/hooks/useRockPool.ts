import { useStore } from '@nanostores/solid'

import type { RockPoolActions } from '../store/rockPool/RockPoolActions'
import type { RockPoolStore } from '../store/rockPool/RockPoolStore'

import { useGame } from './useGame'

export const useRockPool = (): [
  $rocks: RockPoolStore,
  actions: RockPoolActions,
] => {
  const [$game, gameActions] = useGame()
  const { $rocks } = $game.get()
  return [$rocks, gameActions.rocks]
}

export const subscribeRockPool = () => {
  const [$rocks] = useRockPool()
  return useStore($rocks)
}
