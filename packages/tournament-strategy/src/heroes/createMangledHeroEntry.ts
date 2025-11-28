import type { AnyGenome, GenomeEntry } from '@neat-evolution/evaluator'

import { toId } from '../entities/toId.js'

/**
 * Creates a mangled hero entry with synthetic IDs.
 * This prevents heroes from interfering with the normal population evolution
 * by giving them IDs that are well beyond the current species/organism range.
 * @template G - The genome type
 * @param {GenomeEntry<G>} originalEntry - The original hero genome entry
 * @param {number} heroIndex - The index of this hero in the hero list
 * @param {Map<number, GenomeEntry<G>>} genomeEntriesMap - Map of all current genome entries
 * @param {Set<number>} heroIds - Set of hero IDs
 * @param {Set<number>} fillerIds - Set of filler IDs
 * @returns {GenomeEntry<G>} A new genome entry with synthetic IDs
 */
export function createMangledHeroEntry<G extends AnyGenome<G>>(
  originalEntry: GenomeEntry<G>,
  heroIndex: number,
  genomeEntriesMap: Map<number, GenomeEntry<G>>,
  heroIds: Set<number>,
  fillerIds: Set<number>
): GenomeEntry<G> {
  // Find max indices from CURRENT POPULATION only (exclude heroes and fillers)
  let maxSpecies = -1
  let maxOrganism = -1

  for (const entry of genomeEntriesMap.values()) {
    const entryId = toId(entry)
    // Skip heroes and fillers to prevent exponential growth
    if (heroIds.has(entryId) || fillerIds.has(entryId)) {
      continue
    }
    maxSpecies = Math.max(maxSpecies, entry[0])
    maxOrganism = Math.max(maxOrganism, entry[1])
  }

  // Return entry with synthetic IDs beyond current ranges
  return [
    maxSpecies + 100_000, // Well beyond current species
    maxOrganism + 100_000 + heroIndex, // Unique per hero
    originalEntry[2], // Same genome data
  ]
}
