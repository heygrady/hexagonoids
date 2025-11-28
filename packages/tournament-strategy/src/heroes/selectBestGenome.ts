import type { AnyGenome, GenomeEntry } from '@neat-evolution/evaluator'
import type { Player as GlickoPlayer } from 'glicko2'

import { toId } from '../entities/toId.js'

/**
 * Selects the best genome from current generation by raw Glicko rating.
 * @template G - The genome type
 * @param {Array<GenomeEntry<G>>} entries - Current population entries
 * @param {Map<number, GlickoPlayer>} playerRatings - Map of player IDs to Glicko players
 * @param {Set<number>} fillerIds - Set of filler IDs to exclude
 * @returns {GenomeEntry<G> | undefined} Best entry or undefined if none found
 */
export function selectBestGenomeByRawRating<G extends AnyGenome<G>>(
  entries: Array<GenomeEntry<G>>,
  playerRatings: Map<number, GlickoPlayer>,
  fillerIds: Set<number>
): GenomeEntry<G> | undefined {
  let bestEntry: GenomeEntry<G> | undefined
  let bestRating = -Infinity

  for (const entry of entries) {
    const entryId = toId(entry)
    if (fillerIds.has(entryId)) continue

    const player = playerRatings.get(entryId)
    if (player != null) {
      const rating = player.getRating()
      if (rating > bestRating) {
        bestRating = rating
        bestEntry = entry
      }
    }
  }

  return bestEntry
}
