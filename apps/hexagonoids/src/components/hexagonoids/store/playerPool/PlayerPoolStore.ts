import { map, type MapStore } from 'nanostores'

import type { PlayerPoolState } from './PlayerPoolState'

export type PlayerPoolStore = MapStore<PlayerPoolState>

export const createPlayerPoolStore = (): PlayerPoolStore => {
  const $players = map<PlayerPoolState>({})
  return $players
}
