import type { PositionWeights } from './scoring.js'

/**
 * Result of playing a single game between two players
 */
export interface GameResult {
  /** Whether player A won */
  playerAWon: boolean
  /** Whether player B won */
  playerBWon: boolean
  /** Confidence scores for each of player A's moves */
  playerAScores: number[]
  /** Confidence scores for each of player B's moves */
  playerBScores: number[]
}

/**
 * Supported opponent types (serializable for worker threads)
 */
export type OpponentType =
  | 'minimaxAI'
  | 'heuristicAI'
  | 'simpleAI'
  | 'randomAI'
  | 'sleeperAI'

/**
 * Configuration for a specific opponent in the gauntlet
 */
export interface OpponentConfig {
  /** The opponent type (name, not function reference - must be serializable) */
  opponent: OpponentType
  /** Number of matches to play against this opponent */
  numGames: number
  /** Weight of this opponent in the overall fitness calculation */
  weight: number
}

/**
 * Default position weights (used in both gauntlet and head-to-head evaluation)
 */
export const DEFAULT_POSITION_WEIGHTS: PositionWeights = {
  firstPlayer: 0.5,
  secondPlayer: 0.5,
}
