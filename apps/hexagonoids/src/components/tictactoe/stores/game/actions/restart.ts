import { setStatus } from '../GameSetters.js'
import { GameStatus, EvolutionStatus } from '../GameState.js'
import type { GameStore } from '../GameStore.js'

import {
  DEFAULT_POPULATION_SIZE,
  bindGameSetters,
  playerToToken,
  stopBackgroundEvolution,
  stopMatch,
  clearGenerationSnapshots,
  restoreSnapshotsFromStorage,
  getModulePathnamesForAlgorithm,
  loadPopulationFromStorage,
} from './shared.js'
import { start } from './start.js'

export const restart = async (
  $game: GameStore,
  options?: { skipSave?: boolean }
) => {
  const gameSetters = bindGameSetters($game)
  const state = $game.get()
  const settingsState = state.$settings.get()
  const newSettings = settingsState.committed
  const evolutionManager = state.evolutionManager

  // Determine old settings (before apply) for correct save key
  // If previousAlgorithm/Activation are set, settings were just changed
  const oldAlgorithm = settingsState.previousAlgorithm ?? newSettings.algorithm
  const oldActivation =
    settingsState.previousActivation ?? newSettings.activation
  const settingsChanged =
    oldAlgorithm !== newSettings.algorithm ||
    oldActivation !== newSettings.activation

  console.log('[GameActions] Resetting...')
  if (settingsChanged) {
    console.log(
      `[GameActions] Settings changed: ${oldAlgorithm}-${oldActivation} -> ${newSettings.algorithm}-${newSettings.activation}`
    )
  }

  // 1. Signal the game loop to stop
  gameSetters.setEvolutionStatus(EvolutionStatus.Ended)

  // 2. Stop background evolution and wait for cleanup
  await stopBackgroundEvolution($game)

  // 3. Stop current match if in progress
  await stopMatch($game)

  // 4. Reset starting player to AI first
  $game.get().interactiveGame.resetStartingPlayer()
  gameSetters.setHumanPlayerToken(
    playerToToken($game.get().interactiveGame.getHumanPlayerToken())
  )

  // 5. Note: Population is saved by the evolution promise's .then() handler
  // which captures settings at evolution start to avoid race conditions.
  // skipSave is only used when explicitly clearing/resetting a population.
  if (options?.skipSave === true) {
    console.log('[GameActions] Skipping save (reset requested)')
  }

  // 6. Clear all generation snapshots before loading new population
  clearGenerationSnapshots(gameSetters)

  // 7. Get module pathnames for the NEW algorithm
  const modulePathnames = getModulePathnamesForAlgorithm(newSettings.algorithm)

  // 8. Try to load saved population for the NEW settings combo
  const savedData = await loadPopulationFromStorage(
    newSettings.algorithm,
    newSettings.activation
  )

  // 9. Reset population with new settings (now safe - nothing in-flight)
  // If we have saved data, pass all saved config to restore population exactly
  await evolutionManager.resetPopulation({
    algorithm: newSettings.algorithm,
    modulePathnames,
    neatOptions: savedData?.populationData.config,
    populationOptions: savedData?.populationData.populationOptions ?? {
      populationSize: DEFAULT_POPULATION_SIZE,
    },
    genomeOptions: savedData?.populationData.genomeOptions ?? {
      hiddenActivation: newSettings.activation,
    },
    populationFactoryOptions: savedData?.populationData.factoryOptions,
  })

  // 10. Restore snapshots from saved data if available
  if (savedData != null) {
    restoreSnapshotsFromStorage(
      $game,
      gameSetters,
      savedData,
      evolutionManager,
      newSettings.algorithm
    )
  }

  // 11. Clear previous settings after successful switch
  if (settingsChanged) {
    state.$settings.setKey('previousAlgorithm', undefined)
    state.$settings.setKey('previousActivation', undefined)
  }

  // Note: Player Glicko data, match history, and match counter are NOT reset
  // They persist across game resets to maintain player rating progression

  // 12. Reset match statistics
  gameSetters.setWinCount(0)
  gameSetters.setLossCount(0)
  gameSetters.setDrawCount(0)

  // 13. Reset flags
  gameSetters.setIsWaitingForEvolution(false)
  gameSetters.setAutoPlay(false)

  // 14. Reset status
  setStatus($game, GameStatus.NotStarted)
  gameSetters.setEvolutionStatus(EvolutionStatus.NotStarted)

  // 15. Restart the game with fresh state
  await start($game)
}
