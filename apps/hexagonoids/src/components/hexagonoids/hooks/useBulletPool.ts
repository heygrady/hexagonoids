import { useStore } from '@nanostores/solid'

import type { BulletPoolActions } from '../store/bulletPool/BulletPoolActions'
import type { BulletPoolStore } from '../store/bulletPool/BulletPoolStore'

import { useGame } from './useGame'

export const useBulletPool = (): [
  $bullets: BulletPoolStore,
  actions: BulletPoolActions,
] => {
  const [$game, gameActions] = useGame()
  const { $bullets } = $game.get()
  return [$bullets, gameActions.bullets]
}

export const subscribeBulletPool = () => {
  const [$bullets] = useBulletPool()
  return useStore($bullets)
}
