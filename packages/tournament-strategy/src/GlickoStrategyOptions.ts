import type { AnyGenome, GenomeEntry } from '@neat-evolution/evaluator'

import type {
  NormalizationRange,
  GlickoNormalizationRanges,
  GlickoObservedRanges,
  GlickoSettings,
} from './glicko/types.js'
import type { HeroGenome, GlickoPersistenceData } from './heroes/types.js'
import type {
  GlickoScoreComponents,
  GlickoFitnessCalculator,
  GlickoFitnessWeights,
} from './score/types.js'

// Re-export types for external consumers
export type {
  HeroGenome,
  GlickoPersistenceData,
  GlickoScoreComponents,
  GlickoFitnessCalculator,
  GlickoFitnessWeights,
  NormalizationRange,
  GlickoNormalizationRanges,
  GlickoObservedRanges,
  GlickoSettings,
}

/**
 * Options for configuring the GlickoStrategy.
 */
export interface GlickoStrategyOptions<G extends AnyGenome<G>> {
  matchPlayerSize: number
  individualSeeding: boolean
  /**
   * Number of complete seed tournaments to run before head-to-head matches.
   * Each tournament warms up Glicko ratings through multiple rounds against built-in AI.
   * @default 5
   */
  numSeedTournaments?: number
  rounds?: number
  /**
   * The score difference that constitutes a "win" for match conversion.
   * For example, if winDelta is 0.5, a score of 0.75 vs 0.25 would be a win.
   * If the difference is less than winDelta, it's a draw.
   * @default 0.005
   */
  winDelta?: number
  initialHeroes?: Array<HeroGenome<G>>

  /**
   * Async function to provide the Hall of Fame.
   * Called at the start of `evaluate()`.
   * Should return the top heroes, sorted by rating.
   */
  onHeroesUpdated?: (heroes: Array<HeroGenome<G>>) => void

  /**
   * Glicko-2 settings.
   * These are passed directly to the glicko2 library.
   */
  glickoSettings?: Partial<GlickoSettings>

  /**
   * Base rating for a normalized seed score of 0.
   * Ignored if `individualSeeding` is false.
   * @default 1200
   */
  glickoSeedBaseRating?: number

  /**
   * Max additional rating for a normalized seed score of 1.
   * e.g., Base=1200, Range=600 -> Seeded ratings are [1200, 1800]
   * @default 600
   */
  glickoSeedRatingRange?: number

  /**
   * Hero pool size as ratio of population size.
   * The number of active heroes will be Math.ceil(populationSize * heroPoolRatio).
   * @default 0.2 (20% of population)
   */
  heroPoolRatio?: number

  /**
   * Normalization ranges for Glicko-based fitness components.
   * Used to normalize raw ratings, conservative scores, and innovation bonuses to [0, 1].
   *
   * ⚠️ IMPORTANT: The default ranges assume environment fitness scores are in [0, 1].
   * However, when using TicTacToeEnvironment with confidence multiplier,
   * actual fitness scores are typically in [-0.15, 1.5] range.
   * You MUST provide appropriate normalizationRanges that match your environment's
   * expected fitness score range, otherwise fitness calculations will be incorrect.
   *
   * For TicTacToe with confidence multiplier {min: 0.5, max: 1.5}:
   * - environmentFitness: { min: -0.15, max: 1.5 }
   * - seedFitness: { min: -0.15, max: 1.5 }
   * @default { environmentFitness: {min: 0, max: 1}, seedFitness: {min: 0, max: 1}, glickoRating: {min: 800, max: 3000}, conservativeRating: {min: 0, max: 2500} }
   */
  normalizationRanges?: Partial<GlickoNormalizationRanges>

  /** The fitness calculator to use. */
  fitnessWeights?: Partial<GlickoFitnessWeights>

  onObservedRangeUpdate?: (ranges: GlickoObservedRanges) => void

  /**
   * Called at the end of each generation with the best executor's ratings.
   * Provides the entry with the highest final fitness score along with its raw Glicko-2 player data.
   * This is different from onHeroesUpdated which provides the best entry by raw Glicko rating.
   */
  onBestExecutorUpdate?: (data: {
    entry: GenomeEntry<G>
    fitness: number
    rating: number
    rd: number
    vol: number
  }) => void
}

/**
 * Default options for GlickoStrategy.
 */
export const defaultGlickoStrategyOptions: GlickoStrategyOptions<any> = {
  matchPlayerSize: 2,
  individualSeeding: false, // Default to OFF
  numSeedTournaments: 5,
  glickoSeedBaseRating: 1200,
  glickoSeedRatingRange: 600,
  heroPoolRatio: 0.2, // 20% of population size
  normalizationRanges: {
    environmentFitness: { min: 0, max: 1 },
    seedFitness: { min: 0, max: 1 },
    glickoRating: { min: 800, max: 3000 },
    conservativeRating: { min: 0, max: 2500 },
  },
  fitnessWeights: {
    seedWeight: 0.2,
    envWeight: 0.3,
    glickoWeight: 0.4,
    conservativeWeight: 0.1,
  },
}
