import { map, type MapStore } from 'nanostores'
import { createUniqueId } from 'solid-js'

import { defaultPlayerState, type PlayerState } from './PlayerState'

export type PlayerStore = MapStore<PlayerState>

/**
 * This is used by the PlayerPool to create players.
 * @returns
 */
export const createPlayerStore = (): PlayerStore => {
  const $player = map<PlayerState>({ ...defaultPlayerState })
  $player.setKey('id', createUniqueId())
  return $player
}

/**
 * This is used by the PlayerPool to recycle players.
 * @param $player
 */
export const resetPlayer = ($player: PlayerStore) => {
  // preserve the ID and nodes
  const { id } = $player.get()
  $player.set({ ...defaultPlayerState, id })
}
