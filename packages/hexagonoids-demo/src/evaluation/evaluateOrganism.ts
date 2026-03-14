export type FitnessAggregator = (scores: readonly number[]) => number

export const arithmeticMean: FitnessAggregator = (scores) => {
  if (scores.length === 0) {
    throw new Error('Cannot aggregate an empty score set')
  }

  return scores.reduce((sum, score) => sum + score, 0) / scores.length
}
