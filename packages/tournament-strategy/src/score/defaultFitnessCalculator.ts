import type { FitnessCalculator } from './types.js'

/**
 * Default fitness calculator with balanced weighting.
 * Weights: seed=0.2, env=0.2, tournament=0.3, buchholz=0.3
 * @param {any} components - Normalized score components
 * @returns {number} Combined fitness score
 */
export const defaultFitnessCalculator: FitnessCalculator<any> = (
  components
) => {
  const seedWeight = 0.2
  const envWeight = 0.2
  const tournamentWeight = 0.3
  const buchholzWeight = 0.3

  return (
    (components.seedScore ?? 0) * seedWeight +
    components.environmentScore * envWeight +
    components.tournamentScore * tournamentWeight +
    (components.buchholzScore ?? 0) * buchholzWeight
  )
}
