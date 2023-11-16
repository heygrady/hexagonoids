import type { GameExecutor } from '@heygrady/game-environment'

import { fromGenomeId } from './GenomeId.js'
import type { FitnessEntry, TournamentScores } from './types.js'

export const normalizeTournamentScores = (
  tournamentScores: TournamentScores,
  game: GameExecutor<any, any, any, any>
): FitnessEntry[] => {
  const rounds = tournamentScores.length
  const maxTournamentScore = (game.maxScore - game.minScore) * rounds

  // Flattening and summing up scores for each genome
  const totalScores: Record<string, number> = {}
  for (const round of tournamentScores) {
    for (const [genomeId, score] of round) {
      totalScores[genomeId] =
        (totalScores[genomeId] ?? 0) + score - game.minScore * rounds
    }
  }

  // Normalizing scores; converting back to GenomeTupleId
  const fitnessEntries: FitnessEntry[] = []
  for (const [genomeId, totalScore] of Object.entries(totalScores)) {
    const [speciesIndex, organismIndex] = fromGenomeId(genomeId)
    const normalizedScore = totalScore / maxTournamentScore
    fitnessEntries.push([speciesIndex, organismIndex, normalizedScore])
  }

  return fitnessEntries
}
