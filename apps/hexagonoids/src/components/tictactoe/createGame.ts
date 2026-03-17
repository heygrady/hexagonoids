import {
  InteractiveGame,
  createTictactoeManagerConfig,
  DEFAULT_POPULATION_SIZE,
  type CreateTictactoeManagerConfigOptions,
  type SupportedAlgorithm,
} from '@heygrady/tictactoe-demo'
import type { TicTacToeEnvironmentConfig } from '@heygrady/tictactoe-environment'
import {
  type GlickoStrategyOptions,
} from '@heygrady/tournament-strategy'
import type { AnyGenome } from '@neat-evolution/core'
import type { PopulationOptions } from '@neat-evolution/evolution'
import { EvolutionManager } from '@neat-evolution/evolution-manager'
import { hardwareConcurrency } from '@neat-evolution/worker-threads'

import { createBrowserWorkerConfig } from '../shared/neatWorkers/createBrowserWorkerConfig.js'
import { GLICKO_MAX_HISTORY } from './constants/glickoSettings.js'
import { resetBoard } from './stores/board/BoardSetters.js'
import { bindGameActions, type GameActions } from './stores/game/GameActions.js'
import {
  addPlayer,
  bindGameSetters,
  setStatus,
} from './stores/game/GameSetters.js'
import { GameStatus } from './stores/game/GameState.js'
import { createGameStore, type GameStore } from './stores/game/GameStore.js'
import { loadPlayerDataFromStorage } from './stores/game/PlayerPersistence.js'
import { loadPopulationFromStorage } from './stores/game/PopulationPersistence.js'
import { PlayerToken } from './stores/player/PlayerState.js'
import { createPlayerStore } from './stores/player/PlayerStore.js'
import { createSettingsStore } from './stores/settings/SettingsStore.js'

const workerEvaluatorThreadLimit = Math.max(
  1,
  Math.floor(hardwareConcurrency - 1)
)
const modules = import.meta.glob('./modules/*.ts')

// --- EvolutionManager factory ---

export interface CreateManagerOptions
  extends CreateTictactoeManagerConfigOptions {
  algorithm: SupportedAlgorithm
  environmentConfig?: Partial<TicTacToeEnvironmentConfig>
  populationOptions?: Partial<PopulationOptions>
  genomeOptions?: Record<string, unknown>
  neatOptions?: Record<string, unknown>
  strategyOptions?: Partial<GlickoStrategyOptions<AnyGenome>>
}

/**
 * Create a tictactoe EvolutionManager with the standard configuration.
 * Used by both createGame (initial setup) and restart (algorithm/settings change).
 */
export function createTictactoeEvolutionManager(
  options: CreateManagerOptions
): EvolutionManager {
  const workerConfig = createBrowserWorkerConfig(
    modules,
    options.algorithm,
    workerEvaluatorThreadLimit,
    'TicTacToe browser'
  )

  const managerConfig = createTictactoeManagerConfig({
    ...options,
    createEnvironmentPathname: workerConfig.createEnvironmentPathname,
  })

  return new EvolutionManager({
    ...managerConfig,
    evaluation: {
      ...managerConfig.evaluation,
      options: workerConfig.evaluatorConfig,
    },
  })
}

// --- Game creation ---

export const createGame = async (
  size: number
): Promise<[$game: GameStore, GameActions]> => {
  // Create settings store and wait for it to load from storage
  const [$settings, settingsLoaded] = createSettingsStore()
  await settingsLoaded

  // Load persisted player data from IndexedDB
  const playerData = await loadPlayerDataFromStorage()

  const settings = $settings.get().committed

  // Load persisted population data for current algorithm/activation combo
  const savedData = await loadPopulationFromStorage(
    settings.algorithm,
    settings.activation
  )

  // Closure container for game store (populated after store is created)
  const localGameStoreContainer: { $game?: GameStore } = {}

  // Create evolution manager with settings (and optional persisted population)
  const evolutionManager = createTictactoeEvolutionManager({
    algorithm: settings.algorithm,
    neatOptions:
      savedData?.populationData.config != null
        ? { ...savedData?.populationData.config }
        : undefined,
    populationOptions: savedData?.populationData.populationOptions ?? {
      populationSize: DEFAULT_POPULATION_SIZE,
    },
    genomeOptions: savedData?.populationData.genomeOptions ?? {
      hiddenActivation: settings.activation,
    },
    populationFactoryOptions: savedData?.populationData.factoryOptions,
    strategyOptions: {
      onBestExecutorUpdate: (data: {
        rating: number
        rd: number
        vol: number
        fitness: number
      }) => {
        const { $game } = localGameStoreContainer
        if ($game == null) return

        // Store Glicko data for consumption in afterEvaluate callback
        $game.setKey('latestGlickoData', {
          rating: data.rating,
          rd: data.rd,
          vol: data.vol,
          fitness: data.fitness,
        })
      },
    },
  })

  const interactiveGame = new InteractiveGame()

  const $game = createGameStore(
    size,
    interactiveGame,
    evolutionManager,
    $settings
  )

  // Populate closure container before evolution can start
  localGameStoreContainer.$game = $game

  const actions = bindGameActions($game)
  const gameSetters = bindGameSetters($game)

  // Restore persisted player data if available
  if (playerData != null) {
    gameSetters.setPlayerGlickoData(playerData.playerGlickoData)
    // Ensure match history doesn't exceed GLICKO_MAX_HISTORY
    const trimmedHistory =
      playerData.matchHistory.length > GLICKO_MAX_HISTORY
        ? playerData.matchHistory.slice(-GLICKO_MAX_HISTORY)
        : playerData.matchHistory
    $game.setKey('matchHistory', trimmedHistory)
    $game.setKey('matchCounter', playerData.matchCounter)
  }

  // Restore persisted population snapshots if available
  if (savedData != null) {
    // Restore committed snapshot from current population state
    if (savedData.committedSnapshot?.bestOrganismData != null) {
      const organism = evolutionManager.createOrganism(
        savedData.committedSnapshot.bestOrganismData
      )
      const executor = evolutionManager.organismToExecutor(organism)

      const committedSnapshot = {
        ...savedData.committedSnapshot,
        executor,
      }
      gameSetters.setCommitted(committedSnapshot)
    }

    // Restore best snapshot from historical best
    if (savedData.bestSnapshot?.bestOrganismData != null) {
      const organism = evolutionManager.createOrganism(
        savedData.bestSnapshot.bestOrganismData
      )
      const executor = evolutionManager.organismToExecutor(organism)

      const bestSnapshot = {
        ...savedData.bestSnapshot,
        executor,
      }
      gameSetters.setBest(bestSnapshot)
    }

    // Set opponent based on useBestOpponent setting
    const useBestOpponent = settings.useBestOpponent
    const bestSnapshot = $game.get().best
    const committedSnapshot = $game.get().committed
    if (useBestOpponent && bestSnapshot != null) {
      gameSetters.setOpponent({ ...bestSnapshot })
    } else if (committedSnapshot != null) {
      gameSetters.setOpponent({ ...committedSnapshot })
    }
  }

  addPlayer($game, createPlayerStore(PlayerToken.X))
  addPlayer($game, createPlayerStore(PlayerToken.O))

  // Initialize human player token (AI goes first by default, so human is -1 = O)
  const humanPlayer = interactiveGame.getHumanPlayerToken()
  gameSetters.setHumanPlayerToken(
    humanPlayer === 1 ? PlayerToken.X : PlayerToken.O
  )

  // Register callbacks directly on InteractiveGame
  interactiveGame.onBoardChanged((board) => {
    actions.update(board)
  })

  interactiveGame.onMovePlayed(() => {
    setStatus($game, GameStatus.InProgress)
  })

  interactiveGame.onStatusChanged((boardStatus) => {
    if (boardStatus.player1Wins) {
      gameSetters.setWinCount($game.get().winCount + 1)
    } else if (boardStatus.player2Wins) {
      gameSetters.setLossCount($game.get().lossCount + 1)
    } else if (boardStatus.gameOver) {
      gameSetters.setDrawCount($game.get().drawCount + 1)
    }
    resetBoard($game.get().$board)
    setStatus($game, GameStatus.InProgress)
  })

  return [$game, actions]
}
