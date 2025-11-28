import type { AnyGenome, GenomeEntry } from '@neat-evolution/evaluator'

/**
 * Score components collected during tournament evaluation (Swiss strategy).
 * All components are normalized to [0, 1] range before being passed to fitness calculator.
 */
export interface ScoreComponents {
  /** Individual evaluation score (if individualSeeding enabled) */
  seedScore?: number
  /** Average environment fitness across all tournament matches */
  environmentScore: number
  /** Cumulative tournament match points (normalized) */
  tournamentScore: number
  /** Sum of opponents' tournament scores (normalized, if calculated) */
  buchholzScore?: number
}

/**
 * Pluggable fitness calculator that combines score components into final fitness.
 * All components are pre-normalized to [0, 1] range.
 */
export type FitnessCalculator<G extends AnyGenome<G>> = (
  components: ScoreComponents,
  entry: GenomeEntry<G>
) => number

/**
 * Score components for the GlickoStrategy.
 * All components are normalized to [0, 1].
 */
export interface GlickoScoreComponents {
  /**
   * Individual evaluation score (if individualSeeding enabled).
   * Normalized from [minScore, maxScore].
   */
  seedScore?: number
  /**
   * Average environment fitness across all tournament matches.
   * Normalized from [minScore, maxScore].
   */
  environmentScore: number
  /**
   * Raw Glicko rating, normalized using glickoRating range.
   * Represents peak performance potential.
   */
  glickoScore: number
  /**
   * Conservative Glicko score (rating - 2*RD), normalized using conservativeRating range.
   * Penalizes high uncertainty, filters noise.
   */
  conservativeScore: number
}

/**
 * Pluggable fitness calculator for GlickoStrategy.
 */
export type GlickoFitnessCalculator<G extends AnyGenome<G>> = (
  components: GlickoScoreComponents,
  entry: GenomeEntry<G>
) => number

export interface GlickoFitnessWeights {
  seedWeight: number
  envWeight: number
  glickoWeight: number
  conservativeWeight: number
}
