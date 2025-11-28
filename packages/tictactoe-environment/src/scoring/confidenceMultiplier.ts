import type { MoveWeightingConfig } from '../types/scoring.js'

/**
 * Calculates a weighted average of move confidence scores.
 * Earlier moves are weighted more heavily as they matter most strategically.
 * @param {number[]} moveScores - Array of confidence scores (0-1) for each move
 * @param {MoveWeightingConfig} config - Configuration for how to weight moves
 * @returns {number} Weighted average confidence (0-1)
 */
export function calculateMoveWeightedConfidence(
  moveScores: number[],
  config: MoveWeightingConfig
): number {
  if (moveScores.length === 0) {
    return 0
  }

  if (config.strategy === 'equal') {
    // Simple average
    return moveScores.reduce((sum, score) => sum + score, 0) / moveScores.length
  }

  // Recency-weighted: earlier moves get more weight
  let weightedSum = 0
  let weightSum = 0

  for (let i = 0; i < moveScores.length; i++) {
    const weight = Math.max(
      Math.ceil((moveScores.length - i) / (config.divisor ?? 3)),
      1
    )
    weightedSum += (moveScores[i] as number) * weight
    weightSum += weight
  }

  return weightedSum / weightSum
}
