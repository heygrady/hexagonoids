import { setStatus } from '../GameSetters.js'
import {
  GameStatus,
  EvolutionStatus,
  type RuntimeGenerationSnapshot,
} from '../GameState.js'
import type { GameStore } from '../GameStore.js'

import {
  bindGameSetters,
  getOpponent,
  initializeOpponent,
  startBackgroundEvolution,
  waitForRunningStatus,
  waitForEvolutionOrSkip,
  playMatch,
} from './shared.js'

export const start = async ($game: GameStore) => {
  const evolutionManager = $game.get().evolutionManager
  const gameSetters = bindGameSetters($game)
  const interactiveGame = $game.get().interactiveGame

  // Prevent starting if already running
  if ($game.get().status !== GameStatus.NotStarted) {
    return
  }

  setStatus($game, GameStatus.InProgress)
  gameSetters.setEvolutionStatus(EvolutionStatus.Running)

  // Initialize population based on whether we have restored state
  const hasRestoredState = $game.get().committed != null

  // DEBUG: Log restored state check
  console.log('[start] hasRestoredState:', hasRestoredState, {
    committedGen: $game.get().committed?.generation,
    bestGen: $game.get().best?.generation,
    opponentGen: $game.get().opponent?.generation,
  })

  if (!hasRestoredState) {
    // Fresh start - mutate and evaluate population, create generation 0 snapshots
    console.log('[start] Calling initializePopulation...')
    await evolutionManager.initializePopulation()
    console.log('[start] initializePopulation complete')

    const bestExecutor = evolutionManager.getBestExecutor()
    console.log('[start] Got bestExecutor:', bestExecutor != null)
    const best = evolutionManager.population.best()
    console.log(
      '[start] Got best organism:',
      best != null,
      'fitness:',
      best?.fitness
    )
    if (best?.fitness != null) {
      const gen0Snapshot: RuntimeGenerationSnapshot = {
        generation: 0,
        fitness: best.fitness,
        bestOrganismData: best.toJSON(),
        executor: bestExecutor,
      }
      gameSetters.setCommitted({ ...gen0Snapshot })
      gameSetters.setBest(gen0Snapshot)

      // Set opponent based on useBestOpponent setting
      console.log('[start] Calling initializeOpponent...')
      initializeOpponent($game, gameSetters)
      console.log('[start] initializeOpponent complete')
    } else {
      console.warn('[start] No best organism found after initializePopulation!')
    }
  } else {
    // Restored state - skip mutations but still evaluate the population
    console.log('[GameActions] Using restored population state, evaluating...')
    await evolutionManager.population.evaluate()

    const opponent = getOpponent($game)
    if (opponent != null) {
      interactiveGame.setAIExecutor(opponent.executor)
    }
  }

  const gameLoop = async () => {
    while ($game.get().evolutionStatus !== EvolutionStatus.Ended) {
      // 1. Pause Check
      if ($game.get().evolutionStatus !== EvolutionStatus.Running) {
        await waitForRunningStatus($game)
      }

      if ($game.get().evolutionStatus === EvolutionStatus.Ended) break

      // 2. Update AI from opponent snapshot
      const opponent = getOpponent($game)
      if (opponent == null) {
        throw new Error('No opponent available for the match')
      }
      gameSetters.setOpponent({ ...opponent })
      interactiveGame.setAIExecutor(opponent.executor)

      // 3. Trigger Evolution (Background)
      // Only start if not already running (e.g. from previous continuous loop)
      const currentEvolutionPromise = $game.get().evolutionPromise
      if (
        currentEvolutionPromise === null ||
        currentEvolutionPromise === undefined
      ) {
        startBackgroundEvolution($game)
      }

      // 4. Play Match (2 Games)
      await playMatch($game)

      if ($game.get().evolutionStatus === EvolutionStatus.Ended) break

      // 5. Sync Point
      // Wait for either evolution to finish OR user to click "Play Now"
      const evolutionPromise = $game.get().evolutionPromise
      const pending = $game.get().pending
      const autoPlay = $game.get().autoPlay

      // Show overlay/wait if either evolution is running OR evolution finished but not synced
      if (
        (evolutionPromise !== undefined || pending !== undefined) &&
        !autoPlay
      ) {
        await waitForEvolutionOrSkip($game)
      }

      // Apply pending generation update if ready
      // This updates the "Training Center" stats after the match/wait is done
      // The opponent for the next match will be determined by getOpponent() at the start of the next iteration
      const pendingSnapshot = $game.get().pending
      if (pendingSnapshot !== undefined) {
        gameSetters.setCommitted({ ...pendingSnapshot })
        gameSetters.setPending(undefined)
      }

      // Loop immediately. Evolution continues in background if not finished.
    }
  }

  // Do not await gameLoop, let it run in the background
  void gameLoop()
}
