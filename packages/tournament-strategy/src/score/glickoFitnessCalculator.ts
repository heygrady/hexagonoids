import type { GlickoFitnessWeights, GlickoScoreComponents } from './types.js'

/**
 * Calculates final fitness as a weighted combination of Glicko-based score components.
 *
 * The final fitness is computed as:
 * fitness = seedScore * seedWeight + environmentScore * envWeight
 * + glickoScore * glickoWeight + conservativeScore * conservativeWeight
 *
 * If seedScore is not provided, its weight is redistributed to glickoWeight.
 *
 * IMPORTANT: The final fitness can exceed [0, 1] if component values exceed their expected ranges.
 * This is INTENTIONAL and NOT an error. It occurs when:
 *
 * 1. Observed fitness values exceed the configured normalizationRanges bounds
 * - Example: If environmentFitness range is configured as [0, 1] but a genome scores 1.5,
 * the normalized environmentScore will be 1.5, exceeding the [0, 1] bound
 *
 * 2. The weighted combination of components can naturally exceed 1.0
 * - Example: seedScore=1.1, seedWeight=0.4, glickoScore=1.0, glickoWeight=0.6
 * → fitness = 1.1 * 0.4 + 1.0 * 0.6 = 1.04
 *
 * The fitness value is valid and will be used for selection and evolution.
 * If you want fitness strictly bounded to [0, 1], you should:
 * 1. Ensure normalizationRanges are set to cover the full observed range of fitness values
 * 2. Or clamp the final fitness result to [0, 1] after calculating it
 * @param {GlickoScoreComponents} components - Normalized score components (each potentially > 1.0)
 * @param {GlickoFitnessWeights} weights - Weights for each component (must sum to 1.0 for proper fitness scaling)
 * @returns {number} Final weighted fitness value (can exceed [0, 1])
 */
export function glickoFitnessCalculator(
  components: GlickoScoreComponents,
  weights: GlickoFitnessWeights
): number {
  const { seedWeight, envWeight, glickoWeight, conservativeWeight } = weights

  // If seed score isn't provided, its weight is shifted to glicko score
  const effectiveSeedWeight =
    components.seedScore !== undefined ? seedWeight : 0
  const effectiveGlickoWeight =
    glickoWeight + (seedWeight - effectiveSeedWeight)

  return (
    (components.seedScore ?? 0) * effectiveSeedWeight +
    components.environmentScore * envWeight +
    components.glickoScore * effectiveGlickoWeight +
    components.conservativeScore * conservativeWeight
  )
}
