import type { GameStore } from '../GameStore.js'

import { bindGameSetters } from './shared.js'

export const enableAutoPlay = ($game: GameStore) => {
  const gameSetters = bindGameSetters($game)

  // Set autoPlay to true for future waits (until evolution finishes)
  gameSetters.setAutoPlay(true)

  // Skip current wait
  $game.get().skipWaiting?.()
}

export const disableAutoPlay = ($game: GameStore) => {
  const gameSetters = bindGameSetters($game)

  // Set autoPlay to false - training overlay will show after current match
  gameSetters.setAutoPlay(false)
}
