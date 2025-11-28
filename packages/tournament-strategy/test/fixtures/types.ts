import type { GenomeEntry } from '@neat-evolution/evaluator'

import type { GlickoNormalizationRanges } from '../../src/GlickoStrategyOptions.js'

/**
 * Fixture data captured from real GlickoStrategy evaluation.
 * Used for deterministic unit tests.
 */
export interface GlickoEvaluationFixture {
  /** Timestamp when fixture was generated */
  timestamp: string

  /** Generation index when captured */
  generation: number

  /** Population size used */
  populationSize: number

  /** Configuration used for evaluation */
  config: {
    minScore: number
    maxScore: number
    normalizationRanges: GlickoNormalizationRanges
    heroPoolRatio: number
    individualSeeding: boolean
    matchPlayerSize: number
    rounds: number
  }

  /** Evaluation results for each genome in population */
  results: GlickoResultData[]

  /** Hero state captured */
  heroes: GlickoHeroData[]
}

/**
 * Evaluation result for a single genome
 */
export interface GlickoResultData {
  /** Unique ID from toId() */
  entryId: number

  /** Species index */
  speciesIndex: number

  /** Organism index */
  organismIndex: number

  /** Final calculated fitness */
  fitness: number

  /** All 5 normalized components [0, 1] */
  components: {
    seedScore?: number
    environmentScore: number
    glickoScore: number
    conservativeScore: number
    innovationScore: number
  }

  /** Raw data used to calculate components */
  rawData: {
    glickoRating: number
    glickoRd: number
    glickoVol: number
    environmentTotal: number
    environmentCount: number
    previousRating?: number
  }
}

/**
 * Hero data captured from generational heroes
 */
export interface GlickoHeroData {
  /** Generation when hero was created */
  generation: number

  /** Entry ID (mangled) */
  entryId: number

  /** Glicko rating */
  rating: number

  /** Rating deviation */
  rd: number

  /** Volatility */
  vol: number
}

/**
 * Helper to reverse-normalize a value from [0, 1] back to original range
 * @param {number} normalizedValue - The normalized value
 * @param {{ min: number; max: number }} range - The range to reverse normalize to
 * @param {number} range.min - The minimum value of the range
 * @param {number} range.max - The maximum value of the range
 * @returns {number} The reverse normalized value
 */
export function reverseNormalize(
  normalizedValue: number,
  range: { min: number; max: number }
): number {
  return normalizedValue * (range.max - range.min) + range.min
}
