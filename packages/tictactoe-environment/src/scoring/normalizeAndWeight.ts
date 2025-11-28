import type { NormalizationBounds } from '../types/scoring.js'

/**
 * Extracts the appropriate bound value for a given player position.
 * @param {number | [number, number]} bound - Either a single number or a [firstPlayer, secondPlayer] tuple
 * @param {boolean} isFirstPlayer - Whether we're extracting for the first player (true) or second player (false)
 * @returns {number} The bound value for the specified position
 */
function extractBound(
  bound: number | [number, number],
  isFirstPlayer: boolean
): number {
  if (typeof bound === 'number') {
    return bound
  }
  return isFirstPlayer ? bound[0] : bound[1]
}

/**
 * Normalizes a raw score to a 0-1 range and applies a weight.
 * This is a common pattern used throughout the evaluation process.
 * @param {number} rawScore - The raw score to normalize
 * @param {NormalizationBounds} bounds - The expected min/max bounds for normalization (can be position-specific)
 * @param {number} weight - The weight to apply after normalization
 * @param {boolean} isFirstPlayer - Whether normalizing for first player (true) or second player (false)
 * @returns {number} Normalized and weighted score
 */
export function normalizeAndWeight(
  rawScore: number,
  bounds: NormalizationBounds,
  weight: number,
  isFirstPlayer: boolean
): number {
  const min = extractBound(bounds.min, isFirstPlayer)
  const max = extractBound(bounds.max, isFirstPlayer)
  const normalized = (rawScore - min) / (max - min)
  return normalized * weight
}
