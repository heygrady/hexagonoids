import {
  EvolutionManager,
  InteractiveGame,
  type ModulePathnames,
  ModulePathnameKey,
  validateModulePathnames,
  type SupportedAlgorithm,
} from '@heygrady/tictactoe-demo'
// Vite worker URL imports - must use ?worker&url suffix for Vite to bundle correctly
import workerEvaluatorScriptUrl from '@neat-evolution/worker-evaluator/workerEvaluatorScript?worker&url'
import workerReproducerScriptUrl from '@neat-evolution/worker-reproducer/workerReproducerScript?worker&url'

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

// Default population size (matches NEAT-JS defaultPopulationOptions)
const DEFAULT_POPULATION_SIZE = 100

// Vite glob import pattern for resolving module pathnames for worker threads.
// Workers need absolute pathnames, not package names, so we use import.meta.glob()
// to discover modules at build time and convert them to absolute paths.
// See: devlogs/vite-glob-import.md
const modules = import.meta.glob('./modules/*.ts')

/**
 * Extract the bundled module path from a glob import function.
 * In dev mode, the key itself is the path. In production builds,
 * the function contains an import() call with the bundled filename.
 * @param {string} key - The original module key (e.g., './modules/NEATAlgorithmPathname.ts')
 * @param {() => Promise<unknown>} importFn - The dynamic import function from import.meta.glob
 * @returns {string} The resolved pathname for the module
 */
const extractModulePath = (
  key: string,
  importFn: () => Promise<unknown>
): string => {
  const fnString = importFn.toString()

  // The function looks like this (in both prod and dev):
  // () => __vitePreload(() => import("./NEATAlgorithmPathname.bf49d966.js"), [...])
  // We need to extract the path from the import() call
  const importMatch = fnString.match(/import\(["']([^"']+)["']\)/)
  console.log(
    `[extractModulePath] key: ${key}, fnString: ${fnString}, importMatch:`,
    importMatch?.[1]
  )
  if (importMatch != null) {
    // use the bundled filename as the href
    return new URL(importMatch[1], import.meta.url).href
  }
  // Fallback: use the original key as the href
  return new URL(key, import.meta.url).href
}

/**
 * Get module pathnames for a specific algorithm.
 * @param {SupportedAlgorithm} algorithmName - The algorithm name (NEAT, CPPN, etc.)
 * @returns {ModulePathnames} Module pathnames object
 */
export const getModulePathnamesForAlgorithm = (
  algorithmName: SupportedAlgorithm
): ModulePathnames => {
  const modulePathnames: ModulePathnames = {
    algorithmPathname: '',
    createEnvironmentPathname: '',
    createExecutorPathname: '',
  }

  const algorithmPathnameKey = `${algorithmName}AlgorithmPathname`

  for (const [key, importFn] of Object.entries(modules)) {
    if (key.includes(algorithmPathnameKey)) {
      modulePathnames.algorithmPathname = extractModulePath(key, importFn)
    } else if (key.includes(ModulePathnameKey.CREATE_ENVIRONMENT)) {
      modulePathnames.createEnvironmentPathname = extractModulePath(
        key,
        importFn
      )
    } else if (key.includes(ModulePathnameKey.CREATE_EXECUTOR)) {
      modulePathnames.createExecutorPathname = extractModulePath(key, importFn)
    }
  }

  // Validate that all required pathnames were resolved
  validateModulePathnames(modulePathnames)

  return modulePathnames
}

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

  // DEBUG: Log what's being restored
  console.log('[createGame] Loaded savedData:', {
    hasData: savedData != null,
    committedGen: savedData?.committedSnapshot?.generation,
    bestGen: savedData?.bestSnapshot?.generation,
    hasFactoryOptions: savedData?.populationData?.factoryOptions != null,
  })

  // Get module pathnames for the selected algorithm
  const modulePathnames = getModulePathnamesForAlgorithm(settings.algorithm)

  // Closure container for game store (populated after store is created)
  const localGameStoreContainer: { $game?: GameStore } = {}

  // Create evolution manager with settings (and optional persisted population)
  // When restoring from saved data, use the saved config to ensure consistency
  const evolutionManager = new EvolutionManager({
    algorithm: settings.algorithm,
    modulePathnames,
    workerEvaluatorScriptUrl,
    workerReproducerScriptUrl,
    // Use saved config if available, otherwise use defaults
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
      onBestExecutorUpdate: (data) => {
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
        settings.algorithm,
        savedData.committedSnapshot.bestOrganismData
      )
      const executor = evolutionManager.organismToExecutor(organism)

      const committedSnapshot = {
        ...savedData.committedSnapshot,
        executor,
      }
      gameSetters.setCommitted(committedSnapshot)
      console.log(
        `[createGame] Restored committed generation ${committedSnapshot.generation
        } with fitness ${committedSnapshot.fitness.toFixed(4)}`
      )
    }

    // Restore best snapshot from historical best
    if (savedData.bestSnapshot?.bestOrganismData != null) {
      const organism = evolutionManager.createOrganism(
        settings.algorithm,
        savedData.bestSnapshot.bestOrganismData
      )
      const executor = evolutionManager.organismToExecutor(organism)

      const bestSnapshot = {
        ...savedData.bestSnapshot,
        executor,
      }
      gameSetters.setBest(bestSnapshot)
      console.log(
        `[createGame] Restored best generation ${bestSnapshot.generation
        } with fitness ${bestSnapshot.fitness.toFixed(4)}`
      )
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
