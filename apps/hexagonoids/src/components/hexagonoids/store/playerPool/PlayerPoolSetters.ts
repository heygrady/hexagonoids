import { action } from 'nanostores'
import type { OmitFirstArg } from 'nanostores/action'
import { unwrap } from 'solid-js/store'

import type { PlayerStore } from '../player/PlayerStore'

import { releasePlayerStore } from './PlayerPool'
import type { PlayerPoolStore } from './PlayerPoolStore'

interface PlayerPoolSetters {
  add: OmitFirstArg<typeof addPlayer>
  remove: OmitFirstArg<typeof removePlayer>
  clear: OmitFirstArg<typeof clearPlayers>
}

export const bindPlayerPoolSetters = (
  $rockPool: PlayerPoolStore
): PlayerPoolSetters => ({
  add: action($rockPool, 'add', addPlayer),
  remove: action($rockPool, 'remove', removePlayer),
  clear: action($rockPool, 'clear', clearPlayers),
})

export const addPlayer = ($players: PlayerPoolStore, $player: PlayerStore) => {
  const id = $player.get().id

  if (id === undefined) {
    console.warn('Cannot add player without an id')
    return
  }

  const $prevPlayer = $players.get()[id]

  if ($player === $prevPlayer) {
    return
  }

  $players.setKey(id, $player)
}

export const removePlayer = (
  $players: PlayerPoolStore,
  $player: PlayerStore
) => {
  const id = $player.get().id

  if (id === undefined) {
    console.warn('Cannot remove player without an id')
    return
  }

  // remove from active players
  $players.setKey(id, undefined)

  // release back into the pool
  releasePlayerStore(unwrap($player))
}

export const clearPlayers = ($players: PlayerPoolStore) => {
  for (const $player of Object.values($players.get())) {
    if ($player == null) {
      continue
    }
    removePlayer($players, $player)
  }
}
