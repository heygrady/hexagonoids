import type { PlayerFn, PlayerOptions } from '@heygrady/tictactoe-game'

import { normalizeAndWeight } from '../scoring/normalizeAndWeight.js'
import type {
  ConfidenceMultiplierConfig,
  GameOutcomeScores,
  MoveWeightingConfig,
  NormalizationBounds,
  PositionWeights,
} from '../types/scoring.js'

import { playAndScore } from './playAndScore.js'

/**
 * Result of playing a match between two players
 */
export interface MatchResult {
  /** Normalized and weighted score for player A */
  scoreA: number
  /** Normalized and weighted score for player B */
  scoreB: number
  /** Raw score for player A when going first */
  rawScoreA1: number
  /** Raw score for player A when going second */
  rawScoreA2: number
  /** Raw score for player B when going first */
  rawScoreB1: number
  /** Raw score for player B when going second */
  rawScoreB2: number
}

/**
 * Plays a complete match between two players (2 games with swapped positions)
 * and returns normalized/weighted scores for both players.
 *
 * A match consists of:
 * - Game 1: playerA goes first, playerB goes second
 * - Game 2: playerB goes first, playerA goes second
 * @param {PlayerFn} playerA - First player
 * @param {PlayerFn} playerB - Second player
 * @param {NormalizationBounds} normalizationBounds - Bounds for normalizing scores
 * @param {PositionWeights} positionWeights - Weights for first vs second player positions
 * @param {GameOutcomeScores} outcomeScores - Game outcome score configuration
 * @param {ConfidenceMultiplierConfig} confidenceConfig - Confidence multiplier configuration
 * @param {MoveWeightingConfig} moveWeightingConfig - Move weighting configuration
 * @param {PlayerOptions} [options] - Player options (including RNG)
 * @returns {MatchResult} Match result with normalized scores for both players
 */
export function playMatch(
  playerA: PlayerFn,
  playerB: PlayerFn,
  normalizationBounds: NormalizationBounds,
  positionWeights: PositionWeights,
  outcomeScores: GameOutcomeScores,
  confidenceConfig: ConfidenceMultiplierConfig,
  moveWeightingConfig: MoveWeightingConfig,
  options?: PlayerOptions
): MatchResult {
  // --- Game 1: A starts (A=P1, B=P-1) ---
  const [, rawScoreA1, rawScoreB1] = playAndScore(
    playerA,
    playerB,
    1,
    outcomeScores,
    confidenceConfig,
    moveWeightingConfig,
    options
  )

  // Normalize and weight: A went first (easier), B went second (harder)
  const weightedScoreA1 = normalizeAndWeight(
    rawScoreA1,
    normalizationBounds,
    positionWeights.firstPlayer,
    true // A is first player
  )
  const weightedScoreB1 = normalizeAndWeight(
    rawScoreB1,
    normalizationBounds,
    positionWeights.secondPlayer,
    false // B is second player
  )

  // --- Game 2: B starts (B=P1, A=P-1) ---
  const [, rawScoreB2, rawScoreA2] = playAndScore(
    playerB,
    playerA,
    1,
    outcomeScores,
    confidenceConfig,
    moveWeightingConfig,
    options
  )

  // Normalize and weight: B went first (easier), A went second (harder)
  const weightedScoreA2 = normalizeAndWeight(
    rawScoreA2,
    normalizationBounds,
    positionWeights.secondPlayer,
    false // A is second player
  )
  const weightedScoreB2 = normalizeAndWeight(
    rawScoreB2,
    normalizationBounds,
    positionWeights.firstPlayer,
    true // B is first player
  )

  // Combine weighted scores from both games
  const totalWeightPerPlayer =
    positionWeights.firstPlayer + positionWeights.secondPlayer // = 1.0
  const scoreA = (weightedScoreA1 + weightedScoreA2) / totalWeightPerPlayer
  const scoreB = (weightedScoreB1 + weightedScoreB2) / totalWeightPerPlayer

  return {
    scoreA,
    scoreB,
    rawScoreA1,
    rawScoreA2,
    rawScoreB1,
    rawScoreB2,
  }
}
