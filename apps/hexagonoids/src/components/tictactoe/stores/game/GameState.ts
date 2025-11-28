import type {
  EvolutionManager,
  InteractiveGame,
} from '@heygrady/tictactoe-demo'
import type { SyncExecutor } from '@neat-evolution/executor'
import type { Glicko2 } from 'glicko2'

import type { BoardStore } from '../board/BoardStore.js'
import { type PlayerToken } from '../player/PlayerState.js'
import type { PlayerStore } from '../player/PlayerStore.js'
import type { SettingsStore } from '../settings/SettingsStore.js'

export enum GameStatus {
  /** Game is created but `start` has not been called */
  NotStarted = -1,
  /** Game is in progress; not waiting for player input */
  InProgress = 0,
  /** Waiting for player input */
  Waiting = 1,
  /** Player input received */
  Pending = 2,
  /** Game has ended */
  Ended = 10,
}

export enum EvolutionStatus {
  NotStarted = 'not-started',
  Running = 'running',
  Stopping = 'stopping',
  Stopped = 'stopped',
  Ended = 'ended',
}

export type GameOutcome = 'win' | 'loss' | 'draw'

/**
 * Match record for sliding window Glicko-2 calculation.
 * Stores the player's state before the match and the match result.
 */
export interface MatchRecord {
  gameId: string
  timestamp: number // UNIX timestamp

  // The Anchor: Player state BEFORE this specific match occurred
  playerStateBefore: {
    rating: number
    rd: number // Rating Deviation
    vol: number // Volatility
  }

  // The Result: Who we played and what happened
  matchResult: {
    opponentRating: number
    opponentRD: number
    opponentVol: number
    score: number // 1 (win), 0.5 (draw), 0 (loss)
  }
}

/**
 * Serializable snapshot of a generation's state (for storage)
 */
export interface SerializableGenerationSnapshot {
  generation: number
  fitness: number
  bestOrganismData: any
  glickoData?: {
    rating: number
    rd: number
    vol: number
  }
}

/**
 * Runtime snapshot of a generation's state (with executor)
 */
export interface RuntimeGenerationSnapshot
  extends SerializableGenerationSnapshot {
  executor: SyncExecutor
}

/**
 * Snapshot of a generation's state
 * @deprecated Use RuntimeGenerationSnapshot for runtime or SerializableGenerationSnapshot for storage
 */
export type GenerationSnapshot = RuntimeGenerationSnapshot

export interface GameLoop {
  isRunning: () => boolean
  start: () => Promise<void>
  stop: () => Promise<void>
}

export interface GameState {
  $board: BoardStore
  $settings: SettingsStore
  players: PlayerStore[]
  playerIndex: number
  interactiveGame: InteractiveGame
  evolutionManager: EvolutionManager<any>

  // Generation tracking - cohesive entities
  committed?: GenerationSnapshot
  training?: GenerationSnapshot
  pending?: GenerationSnapshot
  opponent?: GenerationSnapshot
  best?: GenerationSnapshot

  // Latest Glicko data from strategy callback
  latestGlickoData?: {
    rating: number
    rd: number
    vol: number
    fitness: number
  }

  // Glicko-2 rating system
  glicko: Glicko2
  playerGlickoData?: {
    rating: number
    rd: number
    vol: number
  }
  matchHistory: MatchRecord[]
  matchCounter: number

  // Match statistics
  winCount: number
  drawCount: number
  lossCount: number

  // Game state
  status: GameStatus
  evolutionStatus: EvolutionStatus
  gameOutcome?: GameOutcome
  loop: GameLoop
  abortController?: AbortController
  matchAbortController?: AbortController
  evolutionPromise?: Promise<any>
  matchPromise?: Promise<void>
  skipWaiting?: () => void
  isWaitingForEvolution: boolean
  autoPlay: boolean
  humanPlayerToken: PlayerToken
  operationStatus?: 'resetting' | 'switching'
}
