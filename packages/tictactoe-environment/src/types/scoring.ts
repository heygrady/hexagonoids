/**
 * Configuration for game outcome base scores
 */
export interface GameOutcomeScores {
  /** Score awarded for winning a game (default: 1) */
  win: number
  /** Score awarded for losing a game (default: 0.1) */
  loss: number
  /** Score awarded for drawing a game (default: 1/3) */
  draw: number
}

/**
 * Configuration for confidence multiplier bounds
 */
export interface ConfidenceMultiplierConfig {
  /** Minimum multiplier for low confidence moves (default: 0.5 = 50% penalty) */
  min: number
  /** Maximum multiplier for high confidence moves (default: 1.5 = 50% bonus) */
  max: number
}

/**
 * Configuration for how to weight moves based on their position in the game
 */
export interface MoveWeightingConfig {
  /** Weighting strategy to use */
  strategy: 'recency-weighted' | 'equal'
  /** For recency-weighted: weight = max(ceil((totalMoves - position) / divisor), 1) */
  divisor?: number
}

/**
 * Simple min/max bounds with just numbers (no position-specific tuples)
 */
export interface SimpleBounds {
  /** Minimum expected score */
  min: number
  /** Maximum expected score */
  max: number
}

/**
 * Min/max bounds for score normalization
 * Each bound can be either:
 * - A single number (same bound for both first and second player)
 * - A tuple [firstPlayerBound, secondPlayerBound] for position-specific bounds
 */
export interface NormalizationBounds {
  /** Minimum expected score */
  min: number | [number, number]
  /** Maximum expected score */
  max: number | [number, number]
}

/**
 * Weights for first vs second player positions
 */
export interface PositionWeights {
  /** Weight for going first (easier position, default: 0.4) */
  firstPlayer: number
  /** Weight for going second (harder position, default: 0.6) */
  secondPlayer: number
}

/**
 * Default game outcome scores
 */
export const DEFAULT_GAME_OUTCOME_SCORES: GameOutcomeScores = {
  win: 1,
  loss: 0.1,
  draw: 1 / 3,
}

/**
 * Default confidence multiplier configuration
 */
export const DEFAULT_CONFIDENCE_MULTIPLIER: ConfidenceMultiplierConfig = {
  min: 0.5,
  max: 1.5,
}

/**
 * Default move weighting configuration
 */
export const DEFAULT_MOVE_WEIGHTING: MoveWeightingConfig = {
  strategy: 'equal',
  divisor: 2,
}

/**
 * Calculates normalization bounds from outcome scores and confidence multiplier
 * @param {GameOutcomeScores} outcomeScores - Game outcome base scores
 * @param {ConfidenceMultiplierConfig} confidenceMultiplier - Confidence multiplier configuration
 * @returns {SimpleBounds} Calculated normalization bounds
 */
export function calculateNormalizationBounds(
  outcomeScores: GameOutcomeScores,
  confidenceMultiplier: ConfidenceMultiplierConfig
): SimpleBounds {
  return {
    min: Math.min(
      outcomeScores.loss * confidenceMultiplier.min,
      outcomeScores.loss * confidenceMultiplier.max
    ),
    max: outcomeScores.win * confidenceMultiplier.max,
  }
}

/**
 * Calculates opponent-specific normalization bounds based on opponent type and configuration.
 * This eliminates the need to manually configure bounds for each opponent by deriving them
 * from the opponent's expected strength and the configured game outcome scores.
 *
 * Bounds per opponent type:
 * - minimaxAI: Perfect play always results in draw or loss, max = draw * confidence.max
 * - heuristicAI: Position-dependent - when opponent is first player best is draw, when second best is win
 * max = [draw*conf.max, win*conf.max] where tuple is [opponent first, opponent second]
 * - simpleAI/randomAI: Can win against weak opponents regardless of position, max = win * confidence.max
 * @param {string} opponentType - Type of opponent ('minimaxAI' | 'heuristicAI' | 'simpleAI' | 'randomAI')
 * @param {GameOutcomeScores} outcomeScores - Game outcome base scores
 * @param {ConfidenceMultiplierConfig} confidenceMultiplier - Confidence multiplier configuration
 * @returns {NormalizationBounds} Calculated bounds appropriate for the opponent type
 */
export function calculateOpponentNormalizationBounds(
  opponentType: string,
  outcomeScores: GameOutcomeScores,
  confidenceMultiplier: ConfidenceMultiplierConfig
): NormalizationBounds {
  const minBound = Math.min(
    outcomeScores.loss * confidenceMultiplier.min,
    outcomeScores.loss * confidenceMultiplier.max
  )

  // Determine max bound based on opponent type
  let maxBound: number | [number, number]

  if (opponentType === 'minimaxAI') {
    // Perfect play: can't win, best outcome is draw
    maxBound = outcomeScores.draw * confidenceMultiplier.max
  } else if (opponentType === 'heuristicAI') {
    // When heuristic is first: best we can do is draw
    // When heuristic is second: best we can do is win
    maxBound = [
      outcomeScores.draw * confidenceMultiplier.max, // Opponent first: can draw
      outcomeScores.win * confidenceMultiplier.max, // Opponent second: can win
    ]
  } else {
    // simpleAI and randomAI: can win against weak opponents
    maxBound = outcomeScores.win * confidenceMultiplier.max
  }

  return {
    min: minBound,
    max: maxBound,
  }
}
