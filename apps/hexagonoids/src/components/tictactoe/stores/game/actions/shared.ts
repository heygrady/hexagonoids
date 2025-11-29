import pDefer from 'p-defer'

import {
  DEFAULT_PLAYER_GLICKO_DATA,
  GLICKO_WINDOW_SIZE,
  GLICKO_MAX_HISTORY,
  PLAYER_GLICKO_RD_FLOOR,
} from '../../../constants/glickoSettings.js'
import { getModulePathnamesForAlgorithm } from '../../../createGame.js'
import { bindBoardSetters } from '../../board/BoardSetters.js'
import { PlayerToken } from '../../player/PlayerState.js'
import type { AlgorithmType } from '../../settings/SettingsStore.js'
import { bindGameSetters } from '../GameSetters.js'
import {
  EvolutionStatus,
  type GameOutcome,
  type RuntimeGenerationSnapshot,
  type MatchRecord,
} from '../GameState.js'
import type { GameStore } from '../GameStore.js'
import { savePlayerDataToStorage } from '../PlayerPersistence.js'
import {
  savePopulationToStorage,
  loadPopulationFromStorage,
  pruneOldPopulations,
} from '../PopulationPersistence.js'

// Default population size (matches NEAT-JS defaultPopulationOptions)
export const DEFAULT_POPULATION_SIZE = 100

/**
 * Convert InteractiveGame Player (1 or -1) to PlayerToken (X or O).
 * @param {1 | -1} player - The player number (1 or -1)
 * @returns {PlayerToken} The corresponding PlayerToken
 */
export const playerToToken = (player: 1 | -1): PlayerToken => {
  return player === 1 ? PlayerToken.X : PlayerToken.O
}

/**
 * Get the opponent snapshot based on the useBestOpponent setting.
 * @param {GameStore} $game - The game store
 * @returns {RuntimeGenerationSnapshot} The opponent snapshot to use
 */
export const getOpponent = (
  $game: GameStore
): RuntimeGenerationSnapshot | undefined => {
  const state = $game.get()
  const useBestOpponent = state.$settings.get().committed.useBestOpponent

  if (useBestOpponent && state.best != null) {
    return { ...state.best }
  }

  // Fall back to committed, or opponent if committed is not set
  const committed =
    state?.committed != null ? { ...state.committed } : undefined
  return committed ?? state.opponent
}

/**
 * Shows the game outcome overlay for a duration
 * @param {ReturnType<typeof bindGameSetters>} gameSetters - The game setters
 * @param {GameOutcome} outcome - The game outcome
 */
export const showGameOutcome = async (
  gameSetters: ReturnType<typeof bindGameSetters>,
  outcome: GameOutcome
) => {
  gameSetters.setGameOutcome(outcome)
  await new Promise((resolve) => setTimeout(resolve, 1000))
  gameSetters.setGameOutcome(undefined)
}

/**
 * Update the player's Glicko-2 rating after a match using sliding window calculation.
 * This implements the "March" algorithm from the devlog:
 * 1. Identify Anchor: Use default stats if history < WINDOW_SIZE, else use history[length - WINDOW_SIZE].playerStateBefore
 * 2. Build Batch: Slice history from anchor to present, append new match
 * 3. Run Simulation: Create temp player with anchor stats, batch update through window
 * 4. Apply RD Floor: Clamp RD to minimum of PLAYER_GLICKO_RD_FLOOR
 * 5. Update History: Push new match record, trim if > GLICKO_MAX_HISTORY
 * @param {GameStore} $game - The game store
 * @param {GameOutcome} outcome - The outcome of the match
 * @param {object} opponentGlickoData - The opponent's Glicko-2 data
 * @param opponentGlickoData.rating
 * @param opponentGlickoData.rd
 * @param opponentGlickoData.vol
 */
export const updatePlayerRating = (
  $game: GameStore,
  outcome: GameOutcome,
  opponentGlickoData: { rating: number; rd: number; vol: number }
) => {
  const gameSetters = bindGameSetters($game)
  const state = $game.get()
  const playerData = state.playerGlickoData
  if (playerData == null) return

  const glicko = state.glicko
  const history = state.matchHistory

  // 1. Identify the Anchor
  // Use history if available (min 1, max GLICKO_WINDOW_SIZE)
  // This ensures rating updates visually after every game while growing the window
  const windowSize = Math.min(history.length, GLICKO_WINDOW_SIZE)
  const anchor =
    history.length === 0
      ? { ...DEFAULT_PLAYER_GLICKO_DATA }
      : history[history.length - windowSize].playerStateBefore

  // 2. Build the Batch
  // Slice history from anchor point to present (grows from 1 to GLICKO_WINDOW_SIZE)
  const windowStart = Math.max(0, history.length - windowSize)
  const windowMatches = history.slice(windowStart)

  // Convert outcome to score (1.0 = win, 0.5 = draw, 0.0 = loss)
  const score = outcome === 'win' ? 1.0 : outcome === 'draw' ? 0.5 : 0.0

  // Append current new match to the batch
  const currentMatch = {
    opponentRating: opponentGlickoData.rating,
    opponentRD: opponentGlickoData.rd,
    opponentVol: opponentGlickoData.vol,
    score,
  }
  const allMatches = [...windowMatches.map((m) => m.matchResult), currentMatch]

  // 3. Run Simulation
  // Create temp player with anchor stats
  const tempPlayer = glicko.makePlayer(anchor.rating, anchor.rd, anchor.vol)

  // Batch update through all matches in the window
  const matchPairs = allMatches.map((match) => {
    const opponent = glicko.makePlayer(
      match.opponentRating,
      match.opponentRD,
      match.opponentVol
    )
    return [tempPlayer, opponent, match.score] as [any, any, number]
  })
  glicko.updateRatings(matchPairs)

  // 4. Apply RD Floor
  const newRating = tempPlayer.getRating()
  let newRd = tempPlayer.getRd()
  const newVol = tempPlayer.getVol()

  // Clamp RD to minimum floor to keep player responsive
  if (newRd < PLAYER_GLICKO_RD_FLOOR) {
    newRd = PLAYER_GLICKO_RD_FLOOR
  }

  // Save the new current rating
  gameSetters.setPlayerGlickoData({
    rating: newRating,
    rd: newRd,
    vol: newVol,
  })

  // 5. Update & Trim History
  // Increment match counter
  const matchCounter = state.matchCounter + 1
  $game.setKey('matchCounter', matchCounter)

  // Store the match with playerStateBefore (the previous rating)
  const matchRecord: MatchRecord = {
    gameId: `${matchCounter}`,
    timestamp: Date.now(),
    playerStateBefore: { ...playerData },
    matchResult: currentMatch,
  }

  // Push to history
  const newHistory = [...history, matchRecord]

  // Trim if exceeds max history
  if (newHistory.length > GLICKO_MAX_HISTORY) {
    newHistory.shift()
  }

  // Update history in state
  $game.setKey('matchHistory', newHistory)

  // 6. Persist to IndexedDB
  // Save player data after each match completes (fire and forget)
  void savePlayerDataToStorage(
    { rating: newRating, rd: newRd, vol: newVol },
    newHistory,
    matchCounter
  )
}

// =============================================================================
// Evolution Control
// =============================================================================

/**
 * Helper to create and store an evolution controller.
 * @param {GameStore} $game - The game store
 * @returns {AbortController} The created abort controller
 */
export const createEvolutionController = ($game: GameStore) => {
  const controller = new AbortController()
  bindGameSetters($game).setAbortController(controller)
  return controller
}

/**
 * Helper to clear the evolution controller if it matches.
 * @param {GameStore} $game - The game store
 * @param {AbortController} controller - The controller to clear
 */
export const clearEvolutionController = (
  $game: GameStore,
  controller: AbortController
) => {
  // Only clear if it matches (race condition protection)
  if ($game.get().abortController === controller) {
    bindGameSetters($game).setAbortController(undefined)
  }
}

/**
 * Starts evolution in the background.
 * @param {GameStore} $game - The game store
 */
export const startBackgroundEvolution = ($game: GameStore) => {
  const gameSetters = bindGameSetters($game)
  const state = $game.get()
  const evolutionManager = state.evolutionManager
  const committedSettings = state.$settings.get().committed
  const generations = committedSettings.generationsPerMatch

  // Capture settings key at start to use for saving
  // This prevents race condition when settings change mid-evolution
  const saveAlgorithm = committedSettings.algorithm
  const saveActivation = committedSettings.activation

  // 1. Create and store controller
  const abortController = createEvolutionController($game)

  // Capture base generation for calculating absolute training generation
  const baseGeneration = $game.get().committed?.generation ?? 0

  // DEBUG: Log base generation calculation
  console.log('[startBackgroundEvolution] baseGeneration:', baseGeneration, {
    committed: $game.get().committed?.generation,
    best: $game.get().best?.generation,
    pending: $game.get().pending?.generation,
    opponent: $game.get().opponent?.generation,
  })

  const promise = evolutionManager
    .evolve({
      iterations: generations,
      signal: abortController.signal,
      initialMutations: 0,
      afterEvaluate: (population: any, iteration: number) => {
        // Update real-time training progress
        const best = population.best()
        if (best?.fitness != null) {
          // iteration is 0-indexed, so absolute generation is base + iteration + 1, e.g. 10 + 0 + 1 = 11, the just-evaluated generation
          const currentGeneration = baseGeneration + iteration + 1

          // DEBUG: Log generation calculation (only first iteration to avoid spam)
          if (iteration === 0) {
            console.log('[afterEvaluate] First iteration generation calc:', {
              baseGeneration,
              iteration,
              currentGeneration,
              committedGen: $game.get().committed?.generation,
            })
          }

          // Get latest Glicko data from strategy callback
          const glickoData = $game.get().latestGlickoData

          // Validate that strategy callback and evaluator agree on best fitness
          if (
            glickoData != null &&
            Math.abs(glickoData.fitness - best.fitness) > 1e-6
          ) {
            throw new Error(
              `Fitness mismatch between strategy (${glickoData.fitness}) and evaluator (${best.fitness})`
            )
          }

          const snapshot: RuntimeGenerationSnapshot = {
            generation: currentGeneration,
            fitness: best.fitness,
            bestOrganismData: JSON.parse(JSON.stringify(best.toJSON())),
            executor: evolutionManager.organismToExecutor(best),
            glickoData:
              glickoData != null
                ? {
                    rating: glickoData.rating,
                    rd: glickoData.rd,
                    vol: glickoData.vol,
                  }
                : undefined,
          }
          gameSetters.setTraining(snapshot)

          // Track historical best fitness across all training
          // This preserves the best ever seen, even if later generations regress
          const currentBest = $game.get().best
          if (currentBest == null || best.fitness > currentBest.fitness) {
            gameSetters.setBest({ ...snapshot })
          }
        }
      },
      afterEvaluateInterval: 1,
    })
    .then((best: any) => {
      // Success handling...
      // NOTE: ignore best. It's not what we want.

      // Promote training to pending
      const training = $game.get().training
      if (training != null) {
        gameSetters.setPending({
          ...training,
        })
        gameSetters.setTraining(undefined)
      }

      // Reset autoPlay when evolution finishes, per requirements
      // "keepPlaying must reset to false when evolution promise finishes"
      gameSetters.setAutoPlay(false)

      // Save population to storage after successful evolution
      // Use captured settings (saveAlgorithm/saveActivation) to avoid race condition
      // when settings change mid-evolution
      const populationData = evolutionManager.getPopulationData()
      // Save both committed and best snapshots
      // Use pending (just-finished training) since committed hasn't been promoted yet
      const committedSnapshot = $game.get().pending ?? $game.get().committed
      const bestSnapshot = $game.get().best

      // DEBUG: Log what's being saved
      console.log('[evolution.then] Saving population:', {
        algorithm: saveAlgorithm,
        activation: saveActivation,
        committedGen: committedSnapshot?.generation,
        bestGen: bestSnapshot?.generation,
        pendingGen: $game.get().pending?.generation,
        trainingGen: $game.get().training?.generation,
      })

      void savePopulationToStorage(
        populationData,
        saveAlgorithm,
        saveActivation,
        committedSnapshot,
        bestSnapshot
      )
      void pruneOldPopulations(5) // Keep max 5 combos

      return best
    })
    .catch((err: any) => {
      if (err.name === 'AbortError' || err.message === 'Aborted') {
        // Expected during reset
        return null
      }
      console.error('[GameActions] Evolution error:', err)
      return null
    })
    .finally(() => {
      // 2. Cleanup references
      clearEvolutionController($game, abortController)
      // Only clear promise if it matches (race condition protection)
      if ($game.get().evolutionPromise === promise) {
        gameSetters.setEvolutionPromise(undefined)
      }
    })

  gameSetters.setEvolutionPromise(promise)
}

/**
 * Stops background evolution in progress.
 * @param {GameStore} $game - The game store
 */
export const stopBackgroundEvolution = async ($game: GameStore) => {
  const evolutionPromise = $game.get().evolutionPromise
  const abortController = $game.get().abortController
  const skipWaiting = $game.get().skipWaiting

  // Trigger skip waiting if the game loop is blocked in waitForEvolutionOrSkip
  skipWaiting?.()

  // Signal abort
  abortController?.abort()

  // Wait for cleanup to complete
  if (evolutionPromise !== null && evolutionPromise !== undefined) {
    await evolutionPromise.catch(() => {
      // Ignore AbortError - expected during stop
    })
  }
}

/**
 * Waits for the evolution status to be Running (or Ended to exit).
 * @param {GameStore} $game - The game store
 */
export const waitForRunningStatus = async ($game: GameStore) => {
  if (
    $game.get().evolutionStatus === EvolutionStatus.Running ||
    $game.get().evolutionStatus === EvolutionStatus.Ended
  ) {
    return
  }

  const deferred = pDefer<undefined>()
  const unbind = $game.listen((value) => {
    if (
      value.evolutionStatus === EvolutionStatus.Running ||
      value.evolutionStatus === EvolutionStatus.Ended
    ) {
      unbind()
      deferred.resolve()
    }
  })
  await deferred.promise
}

/**
 * Waits for evolution to finish OR for a skip signal.
 * @param {GameStore} $game - The game store
 */
export const waitForEvolutionOrSkip = async ($game: GameStore) => {
  const evolutionPromise = $game.get().evolutionPromise
  if (evolutionPromise === null || evolutionPromise === undefined) return

  const gameSetters = bindGameSetters($game)
  const deferred = pDefer<undefined>()
  const skipWait = () => {
    deferred.resolve()
  } // "Play Now" clicked
  gameSetters.setSkipWaiting(skipWait)

  // Flag that we are waiting for UI overlay
  gameSetters.setIsWaitingForEvolution(true)

  try {
    // Wait for evolution OR skip
    await Promise.race([evolutionPromise, deferred.promise])
  } finally {
    gameSetters.setSkipWaiting(undefined)
    gameSetters.setIsWaitingForEvolution(false)
  }
}

// =============================================================================
// Match Control
// =============================================================================

/**
 * Plays a full match (2 games).
 * @param {GameStore} $game - The game store
 */
export const playMatch = async ($game: GameStore) => {
  const interactiveGame = $game.get().interactiveGame
  const gameSetters = bindGameSetters($game)

  // Create match abort controller
  const matchAbortController = new AbortController()
  gameSetters.setMatchAbortController(matchAbortController)

  // Track game outcomes via status listener
  let lastGameOutcome: GameOutcome | null = null
  const handleStatusChange = (status: any) => {
    if (status.gameOver === true) {
      if (status.player1Wins === true) {
        lastGameOutcome = 'win'
      } else if (status.player2Wins === true) {
        lastGameOutcome = 'loss'
      } else {
        lastGameOutcome = 'draw'
      }
    }
  }

  // Attach listener
  interactiveGame.onStatusChanged(handleStatusChange)

  const matchPromise = (async () => {
    try {
      // Game 1
      lastGameOutcome = null
      await interactiveGame.play()

      // Check abort after play
      if (matchAbortController.signal.aborted) return

      if (lastGameOutcome !== null) {
        await showGameOutcome(gameSetters, lastGameOutcome)
        // Update player rating based on game 1 outcome
        const opponentSnapshot = $game.get().opponent
        if (opponentSnapshot?.glickoData != null) {
          updatePlayerRating(
            $game,
            lastGameOutcome,
            opponentSnapshot.glickoData
          )
        }
      }

      // Check abort after outcome display
      if (matchAbortController.signal.aborted) return

      interactiveGame.switchStartingPlayer()
      gameSetters.setHumanPlayerToken(
        playerToToken(interactiveGame.getHumanPlayerToken())
      )

      // Game 2
      lastGameOutcome = null
      await interactiveGame.play()

      // Check abort after play
      if (matchAbortController.signal.aborted) return

      if (lastGameOutcome !== null) {
        await showGameOutcome(gameSetters, lastGameOutcome)
        // Update player rating based on game 2 outcome
        const opponentSnapshot = $game.get().opponent
        if (opponentSnapshot?.glickoData != null) {
          updatePlayerRating(
            $game,
            lastGameOutcome,
            opponentSnapshot.glickoData
          )
        }
      }

      interactiveGame.switchStartingPlayer() // Switch back for next match
      gameSetters.setHumanPlayerToken(
        playerToToken(interactiveGame.getHumanPlayerToken())
      )
    } catch (err: any) {
      if (err.name === 'AbortError') return
      throw err
    }
  })()

  // Store the match promise
  gameSetters.setMatchPromise(matchPromise)

  try {
    await matchPromise
  } finally {
    // Clear match promise and controller when done
    if ($game.get().matchPromise === matchPromise) {
      gameSetters.setMatchPromise(undefined)
    }
    if ($game.get().matchAbortController === matchAbortController) {
      gameSetters.setMatchAbortController(undefined)
    }
  }
}

/**
 * Stops the current match in progress.
 * @param {GameStore} $game - The game store
 */
export const stopMatch = async ($game: GameStore) => {
  const matchPromise = $game.get().matchPromise
  const matchAbortController = $game.get().matchAbortController

  if (matchPromise === null || matchPromise === undefined) return

  // Abort the match controller to skip further game steps
  matchAbortController?.abort()

  // Force-stop the current game to unblock play() promise
  $game.get().interactiveGame.stopGame()

  // Wait for match promise to resolve
  await matchPromise.catch(() => {
    // Ignore errors from stopped match
  })
}

// =============================================================================
// Shared Initialization Helpers (used by start and restart)
// =============================================================================

/**
 * Initialize the opponent from the current state and set it on the interactive game.
 * @param {GameStore} $game - The game store
 * @param {ReturnType<typeof bindGameSetters>} gameSetters - The game setters
 */
export const initializeOpponent = (
  $game: GameStore,
  gameSetters: ReturnType<typeof bindGameSetters>
) => {
  const interactiveGame = $game.get().interactiveGame
  const opponent = getOpponent($game)
  console.log('[initializeOpponent] opponent:', opponent != null, 'executor:', opponent?.executor != null)
  if (opponent != null) {
    gameSetters.setOpponent({ ...opponent })
    interactiveGame.setAIExecutor(opponent.executor)
    console.log('[initializeOpponent] AI executor set successfully')
  } else {
    console.warn('[initializeOpponent] No opponent available!')
  }
}

/**
 * Clear all generation snapshots before loading new population.
 * This prevents old data from leaking into the new population context.
 * @param {ReturnType<typeof bindGameSetters>} gameSetters - The game setters
 */
export const clearGenerationSnapshots = (
  gameSetters: ReturnType<typeof bindGameSetters>
) => {
  gameSetters.setCommitted(undefined)
  gameSetters.setBest(undefined)
  gameSetters.setOpponent(undefined)
  gameSetters.setTraining(undefined)
  gameSetters.setPending(undefined)
  gameSetters.setLatestGlickoData(undefined)
}

/**
 * Saved population data structure (from PopulationPersistence)
 */
export interface SavedPopulationData {
  populationData: {
    config?: any
    populationOptions?: any
    genomeOptions?: any
    factoryOptions?: any
  }
  committedSnapshot?: {
    generation: number
    fitness: number
    bestOrganismData: any
    glickoData?: { rating: number; rd: number; vol: number }
  }
  bestSnapshot?: {
    generation: number
    fitness: number
    bestOrganismData: any
    glickoData?: { rating: number; rd: number; vol: number }
  }
}

/**
 * Restore generation snapshots from saved storage data.
 * Creates organisms and executors for committed and best snapshots.
 * @param {GameStore} $game - The game store
 * @param {ReturnType<typeof bindGameSetters>} gameSetters - The game setters
 * @param {SavedPopulationData} savedData - The saved population data
 * @param {any} evolutionManager - The evolution manager
 * @param {AlgorithmType} algorithm - The algorithm type for creating organisms
 */
export const restoreSnapshotsFromStorage = (
  $game: GameStore,
  gameSetters: ReturnType<typeof bindGameSetters>,
  savedData: SavedPopulationData,
  evolutionManager: any,
  algorithm: AlgorithmType
) => {
  const newSettings = $game.get().$settings.get().committed

  // Restore committed snapshot
  if (savedData.committedSnapshot?.bestOrganismData != null) {
    const organism = evolutionManager.createOrganism(
      algorithm,
      savedData.committedSnapshot.bestOrganismData
    )
    const executor = evolutionManager.organismToExecutor(organism)
    const committedSnapshot = {
      ...savedData.committedSnapshot,
      executor,
    }
    gameSetters.setCommitted(committedSnapshot)
    const gen = committedSnapshot.generation
    const fit = committedSnapshot.fitness.toFixed(4)
    console.log(
      `[GameActions] Restored committed generation ${gen} with fitness ${fit}`
    )
  }

  // Restore best snapshot
  if (savedData.bestSnapshot?.bestOrganismData != null) {
    const organism = evolutionManager.createOrganism(
      algorithm,
      savedData.bestSnapshot.bestOrganismData
    )
    const executor = evolutionManager.organismToExecutor(organism)
    const bestSnapshot = {
      ...savedData.bestSnapshot,
      executor,
    }
    gameSetters.setBest(bestSnapshot)
    const gen = bestSnapshot.generation
    const fit = bestSnapshot.fitness.toFixed(4)
    console.log(
      `[GameActions] Restored best generation ${gen} with fitness ${fit}`
    )
  }

  // Set opponent based on useBestOpponent setting
  const useBestOpponent = newSettings.useBestOpponent
  const best = $game.get().best
  const committed = $game.get().committed
  if (useBestOpponent && best != null) {
    gameSetters.setOpponent({ ...best })
  } else if (committed != null) {
    gameSetters.setOpponent({ ...committed })
  }
}

// =============================================================================
// Re-exports for convenience
// =============================================================================

export { getModulePathnamesForAlgorithm }
export { loadPopulationFromStorage }
export { bindBoardSetters }
export { bindGameSetters }
