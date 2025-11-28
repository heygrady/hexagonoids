import type { PlayerFn, PlayerOptions } from '@heygrady/tictactoe-game'

import type { OpponentConfig } from '../types/evaluation.js'
import type {
  ConfidenceMultiplierConfig,
  GameOutcomeScores,
  MoveWeightingConfig,
  PositionWeights,
} from '../types/scoring.js'
import { calculateOpponentNormalizationBounds } from '../types/scoring.js'
import { resolveOpponent } from '../utils/resolveOpponent.js'

import { playMatch } from './playMatch.js'

/**
 * Validates opponent configuration
 * @param {OpponentConfig} config - Opponent configuration to validate
 * @throws {Error} if configuration is invalid
 */
function validateOpponentConfig(config: OpponentConfig): void {
  if (config.numGames <= 0) {
    throw new Error(
      `Opponent "${config.opponent}" has invalid numGames: ${config.numGames}. Must be > 0.`
    )
  }
  if (config.weight < 0) {
    throw new Error(
      `Opponent "${config.opponent}" has invalid weight: ${config.weight}. Must be >= 0.`
    )
  }
}

/**
 * Evaluates a player against a single opponent over multiple matches.
 * Each match consists of 2 games with swapped positions, using opponent-specific
 * normalization bounds for each position.
 * @param {PlayerFn} player - The player to evaluate
 * @param {OpponentConfig} opponentConfig - Configuration for the opponent
 * @param {PositionWeights} positionWeights - Weights for first vs second player positions
 * @param {GameOutcomeScores} outcomeScores - Game outcome score configuration
 * @param {ConfidenceMultiplierConfig} confidenceConfig - Confidence multiplier configuration
 * @param {MoveWeightingConfig} moveWeightingConfig - Move weighting configuration
 * @param {PlayerOptions} [options] - Player options (including RNG)
 * @returns {number} Average normalized score against this opponent
 */
function evaluateAgainstOpponent(
  player: PlayerFn,
  opponentConfig: OpponentConfig,
  positionWeights: PositionWeights,
  outcomeScores: GameOutcomeScores,
  confidenceConfig: ConfidenceMultiplierConfig,
  moveWeightingConfig: MoveWeightingConfig,
  options?: PlayerOptions
): number {
  const { opponent: opponentType, numGames } = opponentConfig

  // Resolve the opponent name to actual PlayerFn
  const opponentFn = resolveOpponent(opponentType)

  // Calculate opponent-specific normalization bounds based on opponent type and configuration
  const normalizationBounds = calculateOpponentNormalizationBounds(
    opponentType,
    outcomeScores,
    confidenceConfig
  )

  // Play multiple matches and accumulate scores
  let totalScore = 0

  for (let i = 0; i < numGames; i++) {
    const result = playMatch(
      player,
      opponentFn,
      normalizationBounds,
      positionWeights,
      outcomeScores,
      confidenceConfig,
      moveWeightingConfig,
      options
    )

    totalScore += result.scoreA
  }

  // Return the average normalized score across all matches
  return totalScore / numGames
}

/**
 * Evaluates a player against a gauntlet of opponents.
 * Each opponent is played multiple times, with the player going first and second.
 * Scores are normalized per opponent and weighted by opponent importance.
 *
 * This implements the core logic from evaluate().
 * @param {PlayerFn} player - The player to evaluate
 * @param {OpponentConfig[]} opponents - Array of opponent configurations (must not be empty)
 * @param {PositionWeights} positionWeights - Weights for first vs second player positions
 * @param {GameOutcomeScores} outcomeScores - Game outcome score configuration
 * @param {ConfidenceMultiplierConfig} confidenceConfig - Confidence multiplier configuration
 * @param {MoveWeightingConfig} moveWeightingConfig - Move weighting configuration
 * @param {PlayerOptions} [options] - Player options (including RNG)
 * @returns {number} Final weighted fitness score
 * @throws {Error} if opponents array is empty or contains invalid configurations
 */
export function evaluateGauntlet(
  player: PlayerFn,
  opponents: OpponentConfig[],
  positionWeights: PositionWeights,
  outcomeScores: GameOutcomeScores,
  confidenceConfig: ConfidenceMultiplierConfig,
  moveWeightingConfig: MoveWeightingConfig,
  options?: PlayerOptions
): number {
  // Validate inputs
  if (opponents.length === 0) {
    throw new Error(
      'Cannot evaluate gauntlet: opponents array is empty. At least one opponent is required.'
    )
  }

  // Validate all opponent configurations
  for (const config of opponents) {
    validateOpponentConfig(config)
  }

  // Calculate total weight and validate it's positive
  const totalWeight = opponents.reduce((sum, config) => sum + config.weight, 0)
  if (totalWeight <= 0) {
    throw new Error(
      `Cannot evaluate gauntlet: total opponent weight is ${totalWeight}. Must be > 0.`
    )
  }

  // Evaluate against each opponent and accumulate weighted fitness
  let weightedFitness = 0

  for (const opponentConfig of opponents) {
    const avgOpponentScore = evaluateAgainstOpponent(
      player,
      opponentConfig,
      positionWeights,
      outcomeScores,
      confidenceConfig,
      moveWeightingConfig,
      options
    )

    // Add this opponent's contribution to the final fitness
    weightedFitness += avgOpponentScore * opponentConfig.weight
  }

  // Return the final weighted average
  return weightedFitness / totalWeight
}
