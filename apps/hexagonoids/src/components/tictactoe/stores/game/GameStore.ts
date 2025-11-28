import type {
  EvolutionManager,
  InteractiveGame,
} from '@heygrady/tictactoe-demo'
import { Glicko2 } from 'glicko2'
import { map, type MapStore } from 'nanostores'

import {
  GLICKO_SETTINGS,
  DEFAULT_PLAYER_GLICKO_DATA,
} from '../../constants/glickoSettings.js'
import { createBoardStore } from '../board/BoardStore.js'
import { PlayerToken } from '../player/PlayerState.js'
import type { SettingsStore } from '../settings/SettingsStore.js'

import { GameStatus, type GameState, EvolutionStatus } from './GameState.js'

export type GameStore = MapStore<GameState>

export const createGameStore = (
  size: number,
  interactiveGame: InteractiveGame,
  evolutionManager: EvolutionManager<any>,
  $settings: SettingsStore
): GameStore => {
  if (size < 3) {
    throw new Error('Board size must be at least 3')
  }
  const state: GameState = {
    $board: createBoardStore(size),
    $settings,
    players: [],
    playerIndex: 0,
    interactiveGame,
    evolutionManager,

    // Generation entities
    committed: undefined,
    training: undefined,
    pending: undefined,
    opponent: undefined,
    best: undefined,

    // Glicko-2 rating system (matches GlickoStrategy settings)
    glicko: new Glicko2(GLICKO_SETTINGS),
    latestGlickoData: undefined,
    playerGlickoData: { ...DEFAULT_PLAYER_GLICKO_DATA },
    matchHistory: [],
    matchCounter: 0,

    // Match statistics
    winCount: 0,
    drawCount: 0,
    lossCount: 0,

    // Game state
    status: GameStatus.NotStarted,
    evolutionStatus: EvolutionStatus.NotStarted,
    gameOutcome: undefined,
    loop: null as any,
    abortController: undefined,
    evolutionPromise: undefined,
    skipWaiting: undefined,
    isWaitingForEvolution: false,
    autoPlay: false,
    humanPlayerToken: PlayerToken.O, // Default: AI goes first, so human is -1 (O)
  }
  return map<GameState>(state)
}
