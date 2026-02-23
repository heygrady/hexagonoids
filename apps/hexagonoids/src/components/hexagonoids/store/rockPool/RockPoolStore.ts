import { type MapStore, map } from 'nanostores'

import type { RockPoolState } from './RockPoolState'

export type RockPoolStore = MapStore<RockPoolState>

export const createRockPoolStore = (): RockPoolStore => {
  const $rocks = map<RockPoolState>({})
  return $rocks
}
