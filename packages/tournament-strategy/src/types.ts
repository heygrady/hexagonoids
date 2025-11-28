import type { AnyGenome } from '@neat-evolution/evaluator'

import type { ScoreComponents, FitnessCalculator } from './score/types.js'

// Re-export types for external consumers
export type { ScoreComponents, FitnessCalculator }

/**
 * Configuration options for Swiss Tournament Strategy.
 */
export interface SwissTournamentStrategyOptions<G extends AnyGenome<G>> {
  /** Number of players per match (default: 2) */
  matchPlayerSize?: number
  /** Number of tournament rounds (default: ceil(log2(populationSize))) */
  rounds?: number
  /** Minimum score for normalization (default: -0.25) */
  minScore?: number
  /** Maximum score for normalization (default: 3) */
  maxScore?: number
  /**
   * The score difference that constitutes a "win" for match conversion.
   * For example, if winDelta is 0.5, a score of 0.75 vs 0.25 would be a win.
   * If the difference is less than winDelta, it's a draw.
   * @default 0.5
   */
  winDelta?: number
  /** Evaluate each genome individually before tournament to establish seeding (default: false) */
  individualSeeding?: boolean
  /**
   * Pluggable fitness calculator for combining score components.
   * Defaults to balanced weighting (0.2 seed, 0.2 env, 0.3 tournament, 0.3 buchholz).
   */
  fitnessCalculator?: FitnessCalculator<G>
}

/**
 * Internal type for tracking player scores.
 * Tuple of [composite entry ID, score].
 */
export type PlayerScore = [entryId: number, score: number]
