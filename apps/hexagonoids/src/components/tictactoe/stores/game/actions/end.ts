import { EvolutionStatus } from '../GameState.js'
import type { GameStore } from '../GameStore.js'

import { bindGameSetters } from './shared.js'

export const end = async ($game: GameStore) => {
  bindGameSetters($game).setEvolutionStatus(EvolutionStatus.Ended)
  // Signal abort
  $game.get().abortController?.abort()
  // Cleanup handled in startBackgroundEvolution finally block,
  // but we can ensure immediate UI update if needed.
  await $game.get().evolutionManager.terminate()
}
