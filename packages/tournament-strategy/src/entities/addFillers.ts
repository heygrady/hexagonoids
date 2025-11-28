import type { AnyGenome, GenomeEntry } from '@neat-evolution/evaluator'

import { toId } from './toId.js'

/**
 * Add synthetic filler genomes to complete incomplete batches.
 * Uses random existing genomes with synthetic IDs to avoid affecting real scores.
 * @template G - The genome type
 * @param {Array<GenomeEntry<G>>} entries - Original genome entries
 * @param {number} matchPlayerSize - Number of players per match
 * @param {Set<number>} fillerIds - A Set to track the IDs of filler genomes.
 * @returns {Array<GenomeEntry<G>>} New array with fillers added
 */
export function addFillers<G extends AnyGenome<G>>(
  entries: Array<GenomeEntry<G>>,
  matchPlayerSize: number,
  fillerIds: Set<number>
): Array<GenomeEntry<G>> {
  const remainder = entries.length % matchPlayerSize
  if (remainder === 0) {
    return entries
  }

  const fillersNeeded = matchPlayerSize - remainder

  // Find max indices to generate synthetic IDs
  let maxSpeciesIndex = -1
  let maxOrganismIndex = -1
  for (const entry of entries) {
    maxSpeciesIndex = Math.max(maxSpeciesIndex, entry[0])
    maxOrganismIndex = Math.max(maxOrganismIndex, entry[1])
  }

  const result = [...entries]

  // Create required number of filler genomes
  for (let i = 0; i < fillersNeeded; i++) {
    // Select a random genome to clone
    // Using a simple random selection for now, can be improved with a proper RNG
    const randomEntry = entries[Math.floor(Math.random() * entries.length)]
    if (randomEntry == null) {
      throw new Error('No entries available to create filler')
    }

    // Create filler with synthetic IDs
    const fillerEntry: GenomeEntry<G> = [
      maxSpeciesIndex + 1,
      maxOrganismIndex + 1 + i, // Increment organism index for each filler
      randomEntry[2],
    ]

    // Track filler ID for exclusion from final results
    fillerIds.add(toId(fillerEntry))

    result.push(fillerEntry)
  }

  return result
}
