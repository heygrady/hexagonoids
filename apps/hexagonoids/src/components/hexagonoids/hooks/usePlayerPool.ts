import { useStore } from '@nanostores/solid'

import type { PlayerPoolActions } from '../store/playerPool/PlayerPoolActions'
import type { PlayerPoolStore } from '../store/playerPool/PlayerPoolStore'

import { useGame } from './useGame'

export const usePlayerPool = (): [
  $players: PlayerPoolStore,
  actions: PlayerPoolActions,
] => {
  const [$game, gameActions] = useGame()
  const { $players } = $game.get()
  return [$players, gameActions.players]
}

export const subscribePlayerPool = () => {
  const [$players] = usePlayerPool()
  return useStore($players)
}
