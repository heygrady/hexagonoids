import { action } from 'nanostores'
import type { OmitFirstArg } from 'nanostores/action'

import type { PlayerStore } from './PlayerStore'

export interface PlayerSetters {
  decrementLives: OmitFirstArg<typeof decrementLives>
  setLives: OmitFirstArg<typeof setLives>
  incrementScore: OmitFirstArg<typeof incrementScore>
  setScore: OmitFirstArg<typeof setScore>
}

export const bindPlayerSetters = ($player: PlayerStore): PlayerSetters => ({
  decrementLives: action($player, 'decrementLives', decrementLives),
  setLives: action($player, 'setLives', setLives),
  incrementScore: action($player, 'incrementScore', incrementScore),
  setScore: action($player, 'setScore', setScore),
})

export const decrementLives = ($player: PlayerStore, lives: number = 1) => {
  if (lives === 0) {
    return
  }
  const diff = $player.get().lives - lives
  if (diff < 0) {
    throw new Error('Cannot decrement lives to a negative number')
  }
  setLives($player, diff)
}

export const setLives = ($player: PlayerStore, lives: number) => {
  const playerState = $player.get()
  const alive = playerState.alive
  if (!alive) {
    throw new Error('Cannot set lives for a dead player')
  }
  const prevLives = playerState.lives
  if (lives === prevLives) {
    return
  }
  if (lives < 0) {
    throw new Error('Cannot set lives to a negative number')
  }
  $player.setKey('lives', lives)
}

export const incrementScore = ($player: PlayerStore, score: number) => {
  if (score === 0) {
    return
  }
  setScore($player, $player.get().score + score)
}

export const setScore = ($player: PlayerStore, score: number) => {
  const playerState = $player.get()
  const alive = playerState.alive
  if (!alive) {
    throw new Error('Cannot set score for a dead player')
  }
  const prevScore = playerState.score
  if (score === prevScore) {
    return
  }
  if (score < 0) {
    throw new Error('Cannot set score to a negative number')
  }
  $player.setKey('score', score)
}
