import type { OpponentConfig } from './types/evaluation.js'
import { DEFAULT_POSITION_WEIGHTS } from './types/evaluation.js'
import type {
  ConfidenceMultiplierConfig,
  GameOutcomeScores,
  MoveWeightingConfig,
  PositionWeights,
} from './types/scoring.js'
import {
  DEFAULT_CONFIDENCE_MULTIPLIER,
  DEFAULT_GAME_OUTCOME_SCORES,
  DEFAULT_MOVE_WEIGHTING,
} from './types/scoring.js'

/**
 * Complete configuration for TicTacToeEnvironment
 */
export interface TicTacToeEnvironmentConfig {
  /** Game outcome base scores */
  gameOutcomeScores: GameOutcomeScores
  /** Confidence multiplier configuration */
  confidenceMultiplier: ConfidenceMultiplierConfig
  /** Move weighting strategy */
  moveWeighting: MoveWeightingConfig
  /** Position weights used for both gauntlet and head-to-head evaluation */
  positionWeights: PositionWeights
  /** Array of opponents to play against in gauntlet evaluation */
  gauntletOpponents: OpponentConfig[]
}

/**
 * Default configuration matching original behavior
 */
export const DEFAULT_ENVIRONMENT_CONFIG: TicTacToeEnvironmentConfig = {
  gameOutcomeScores: DEFAULT_GAME_OUTCOME_SCORES,
  confidenceMultiplier: DEFAULT_CONFIDENCE_MULTIPLIER,
  moveWeighting: DEFAULT_MOVE_WEIGHTING,
  positionWeights: DEFAULT_POSITION_WEIGHTS,
  gauntletOpponents: [
    {
      opponent: 'minimaxAI',
      numGames: 5,
      weight: 0.25,
    },
    {
      opponent: 'heuristicAI',
      numGames: 5,
      weight: 0.25,
    },
    {
      opponent: 'sleeperAI',
      numGames: 25,
      weight: 0.25,
    },
    {
      opponent: 'randomAI',
      numGames: 25,
      weight: 0.25,
    },
  ],
}

/**
 * Merges partial configuration with defaults
 * @param {Partial<TicTacToeEnvironmentConfig>} [partial] - Optional partial configuration to merge
 * @returns {TicTacToeEnvironmentConfig} Merged configuration with defaults
 */
export function mergeConfig(
  partial?: Partial<TicTacToeEnvironmentConfig>
): TicTacToeEnvironmentConfig {
  if (partial === undefined) {
    return DEFAULT_ENVIRONMENT_CONFIG
  }

  return {
    gameOutcomeScores: {
      ...DEFAULT_ENVIRONMENT_CONFIG.gameOutcomeScores,
      ...partial.gameOutcomeScores,
    },
    confidenceMultiplier: {
      ...DEFAULT_ENVIRONMENT_CONFIG.confidenceMultiplier,
      ...partial.confidenceMultiplier,
    },
    moveWeighting: {
      ...DEFAULT_ENVIRONMENT_CONFIG.moveWeighting,
      ...partial.moveWeighting,
    },
    positionWeights: {
      ...DEFAULT_ENVIRONMENT_CONFIG.positionWeights,
      ...partial.positionWeights,
    },
    gauntletOpponents:
      partial.gauntletOpponents ?? DEFAULT_ENVIRONMENT_CONFIG.gauntletOpponents,
  }
}
