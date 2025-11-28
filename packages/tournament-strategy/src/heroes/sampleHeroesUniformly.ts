import type { AnyGenome } from '@neat-evolution/evaluator'

import type { HeroGenome } from './types.js'

/**
 * Samples heroes uniformly across the rating spectrum.
 * Sorts by rating and samples evenly from weak to strong.
 * This ensures genomes face opposition at all skill levels.
 * @template G - The genome type
 * @param {Map<number, HeroGenome<G>>} generationalHeroes - Map of hero IDs to hero genomes
 * @param {number} maxActiveHeroes - Maximum number of heroes to sample
 * @returns {Array<HeroGenome<G>>} Array of sampled heroes
 */
export function sampleHeroesUniformly<G extends AnyGenome<G>>(
  generationalHeroes: Map<number, HeroGenome<G>>,
  maxActiveHeroes: number
): Array<HeroGenome<G>> {
  const allHeroes = Array.from(generationalHeroes.entries()).sort(
    (a, b) => a[1][1].rating - b[1][1].rating
  ) // Sort by rating (ascending: weak to strong)

  const n = allHeroes.length

  // Use all heroes if we haven't hit the limit
  if (n <= maxActiveHeroes) {
    return allHeroes.map(([_, hero]) => hero)
  }

  // Uniform sampling: evenly spaced across rating spectrum
  const step = (n - 1) / (maxActiveHeroes - 1)
  const sampled: Array<HeroGenome<G>> = []

  for (let i = 0; i < maxActiveHeroes; i++) {
    const idx = Math.round(i * step)
    const sampledHero = allHeroes[idx]?.[1]
    if (sampledHero != null) {
      sampled.push(sampledHero)
    }
  }

  return sampled
}
