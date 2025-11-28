import type {
  ConfidenceMultiplierConfig,
  GameOutcomeScores,
  MoveWeightingConfig,
} from '../types/scoring.js'

import { calculateMoveWeightedConfidence } from './confidenceMultiplier.js'

/**
 * Calculates the score for a single player based on win/loss/draw status
 * and the confidence of their moves.
 *
 * The final score is: baseScore * confidenceMultiplier
 * - baseScore comes from the game outcome (win/loss/draw)
 * - confidenceMultiplier ranges from config.min to config.max based on move quality
 * @param {boolean} didWin - Whether the player won
 * @param {boolean} didLose - Whether the player lost
 * @param {number[]} moveScores - Confidence scores (0-1) for each move made
 * @param {GameOutcomeScores} outcomeScores - Configuration for win/loss/draw base scores
 * @param {ConfidenceMultiplierConfig} confidenceConfig - Configuration for confidence multiplier bounds
 * @param {MoveWeightingConfig} moveWeightingConfig - Configuration for how to weight moves
 * @returns {number} The calculated fitness score
 */
export function calculateScore(
  didWin: boolean,
  didLose: boolean,
  moveScores: number[],
  outcomeScores: GameOutcomeScores,
  confidenceConfig: ConfidenceMultiplierConfig,
  moveWeightingConfig: MoveWeightingConfig
): number {
  // Determine base score from game outcome
  const gameOutcomeScore = didWin
    ? outcomeScores.win
    : didLose
    ? outcomeScores.loss
    : outcomeScores.draw

  // If no moves were made, return base score
  if (moveScores.length === 0) {
    return gameOutcomeScore
  }

  // Calculate weighted confidence from move scores
  const weightedConfidence = calculateMoveWeightedConfidence(
    moveScores,
    moveWeightingConfig
  )

  // Map confidence (0-1) to multiplier range (min to max)
  const multiplier =
    confidenceConfig.min +
    (confidenceConfig.max - confidenceConfig.min) * weightedConfidence

  return gameOutcomeScore * multiplier
}
