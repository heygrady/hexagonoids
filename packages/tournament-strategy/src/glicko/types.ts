/** Normalization range for a fitness component. */
export interface NormalizationRange {
  min: number | null
  max: number | null
}

/** Configurable normalization ranges for Glicko components. */
export interface GlickoNormalizationRanges {
  environmentFitness: NormalizationRange
  seedFitness: NormalizationRange
  glickoRating: NormalizationRange
  conservativeRating: NormalizationRange
}

/**
 * Observed ranges for tracking actual values during evolution.
 * Extends normalization ranges with seed AI player ratings for monitoring.
 */
export interface GlickoObservedRanges extends GlickoNormalizationRanges {
  seedGlickoRating: NormalizationRange
  seedConservativeRating: NormalizationRange
}

export interface GlickoSettings {
  tau: number // Volatility constraint. Default: 0.5
  rating: number // Starting rating for new players. Default: 1500
  rd: number // Starting rating deviation. Default: 350
  vol: number // Starting volatility. Default: 0.06
}
