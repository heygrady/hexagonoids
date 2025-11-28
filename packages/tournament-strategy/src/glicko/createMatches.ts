import type { AnyGenome, GenomeEntry } from '@neat-evolution/evaluator'
import type { Player as GlickoPlayer } from 'glicko2'

import { toId } from '../entities/toId.js'

/**
 * Creates matches based on Glicko ratings with Swiss-style pairing.
 * O(N log N) complexity - sorts by rating and pairs adjacent players.
 * Prevents rematches by tracking previous opponents.
 * @template G - The genome type
 * @param {Array<GenomeEntry<G>>} entries - All genome entries to pair
 * @param {Map<number, GlickoPlayer>} playerRatings - Map of entry IDs to Glicko players
 * @param {Map<number, Set<number>>} previousOpponents - Map tracking which opponents have already played each other
 * @param {number} matchPlayerSize - Number of players per match (currently only supports 2)
 * @returns {Array<Array<GenomeEntry<G>>>} Array of matches, where each match is an array of entries
 */
export function createGlickoMatches<G extends AnyGenome<G>>(
  entries: Array<GenomeEntry<G>>,
  playerRatings: Map<number, GlickoPlayer>,
  previousOpponents: Map<number, Set<number>>,
  matchPlayerSize: number
): Array<Array<GenomeEntry<G>>> {
  if (matchPlayerSize !== 2) {
    throw new Error('GlickoStrategy currently only supports 2-player matches.')
  }

  // Sort all entries by their current Glicko rating, descending
  // Make a copy to avoid mutating the input array
  const sortedEntries = [...entries].sort((a, b) => {
    const ratingA = playerRatings.get(toId(a))?.getRating() ?? 0
    const ratingB = playerRatings.get(toId(b))?.getRating() ?? 0
    return ratingB - ratingA
  })

  const matches: Array<Array<GenomeEntry<G>>> = []
  const paired = new Set<number>()

  for (let i = 0; i < sortedEntries.length - 1; i++) {
    const entryA = sortedEntries[i]
    if (entryA == null || paired.has(toId(entryA))) {
      continue
    }

    // Find the next unpaired player who hasn't played entryA before
    let entryB: GenomeEntry<G> | undefined
    const entryAId = toId(entryA)
    const alreadyPlayed = previousOpponents.get(entryAId)

    for (let j = i + 1; j < sortedEntries.length; j++) {
      const potentialOpponent = sortedEntries[j]
      if (potentialOpponent == null || paired.has(toId(potentialOpponent))) {
        continue
      }

      // Check if they've already played each other
      const potentialId = toId(potentialOpponent)
      if (alreadyPlayed != null && alreadyPlayed.has(potentialId)) {
        continue // Skip this opponent, look for another
      }

      entryB = potentialOpponent
      break
    }

    if (entryB != null) {
      // entryAId already defined above (line 318)
      const entryBId = toId(entryB)

      paired.add(entryAId)
      paired.add(entryBId)

      // Track opponents to prevent rematches in future rounds
      // (important since agents are deterministic - rematches are wasteful and biased)
      previousOpponents.get(entryAId)?.add(entryBId)
      previousOpponents.get(entryBId)?.add(entryAId)

      matches.push([entryA, entryB])
    }
  }

  return matches
}
