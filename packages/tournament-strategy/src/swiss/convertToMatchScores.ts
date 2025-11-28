import type { FitnessData } from '@neat-evolution/evaluator'

import { toId } from '../entities/toId.js'

/**
 * Convert environment fitness scores from a match into tournament match points.
 * Determines win/draw/loss based on score differences.
 * @param {FitnessData[]} matchResults - Environment fitness scores for one match
 * @param {number} winDelta - The minimum difference in score to consider a win.
 * @returns {Map<number, number>} Match points for each player
 */
export function convertToMatchScores(
  matchResults: FitnessData[],
  winDelta: number
): Map<number, number> {
  const winValue = 1
  const drawValue = 0.5
  const lossValue = 0

  const matchScores = new Map<number, number>()

  // For 2-player matches, compare scores
  if (matchResults.length === 2) {
    const resultA = matchResults[0]
    const resultB = matchResults[1]
    if (resultA == null || resultB == null) {
      throw new Error('Invalid match results')
    }
    const entryIdA = toId(resultA)
    const entryIdB = toId(resultB)
    const fitnessA = resultA[2]
    const fitnessB = resultB[2]

    if (fitnessA > fitnessB && fitnessA - fitnessB > winDelta) {
      matchScores.set(entryIdA, winValue)
      matchScores.set(entryIdB, lossValue)
    } else if (fitnessB > fitnessA && fitnessB - fitnessA > winDelta) {
      matchScores.set(entryIdA, lossValue)
      matchScores.set(entryIdB, winValue)
    } else {
      matchScores.set(entryIdA, drawValue)
      matchScores.set(entryIdB, drawValue)
    }
  } else {
    // For multi-player matches, rank by fitness
    // Higher fitness → more points
    const sorted = [...matchResults].sort((a, b) => b[2] - a[2])
    for (let i = 0; i < sorted.length; i++) {
      const entry = sorted[i]
      if (entry == null) {
        continue
      }
      const entryId = toId(entry)
      // Simple linear scoring: first place gets N-1 points, last gets 0
      const points = (sorted.length - 1 - i) / (sorted.length - 1)
      matchScores.set(entryId, points)
    }
  }

  return matchScores
}
