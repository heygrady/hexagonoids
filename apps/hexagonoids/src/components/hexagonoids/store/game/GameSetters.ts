import { action } from 'nanostores'
import type { OmitFirstArg } from 'nanostores/action'

import type { PlayerStore } from '../player/PlayerStore'

import type { GameStore } from './GameStore'

interface GameSetters {
  setPlayer: OmitFirstArg<typeof setPlayer>
}

export const bindGameSetters = ($game: GameStore): GameSetters => ({
  setPlayer: action($game, 'setPlayer', setPlayer),
})

export const setPlayer = ($game: GameStore, $player: PlayerStore) => {
  $game.setKey('$player', $player)
}

export const setStartedAt = ($game: GameStore, now?: number) => {
  const startedAt = now ?? Date.now()
  const prev = $game.get().startedAt
  if (prev !== startedAt) {
    $game.setKey('startedAt', startedAt)
  }
}

export const setEndedAt = ($game: GameStore, now?: number) => {
  const endedAt = now ?? Date.now()
  const prev = $game.get().endedAt
  if (prev !== endedAt) {
    $game.setKey('endedAt', endedAt)
  }
}
