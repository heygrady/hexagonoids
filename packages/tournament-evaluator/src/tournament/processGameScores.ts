import type { PlayerScore } from './types.ts'

export const processGameScores = (
  gameScores: PlayerScore[][]
): PlayerScore[] => {
  const scores: Record<string, [totalScore: number, count: number]> = {}

  for (const scoreGroup of gameScores) {
    for (const scoreEntry of scoreGroup) {
      const [genomeId, score] = scoreEntry

      if (scores[genomeId] != null) {
        const compoundScore = scores[genomeId] as [
          totalScore: number,
          count: number,
        ]
        compoundScore[0] += score
        compoundScore[1] += 1
      } else {
        scores[genomeId] = [score, 1]
      }
    }
  }

  // Calculate average scores; create the final score entries
  const averagedScores: PlayerScore[] = []
  for (const [genomeId, score] of Object.entries(scores)) {
    const averageScore = score[0] / score[1]
    averagedScores.push([genomeId, averageScore])
  }

  return averagedScores
}
