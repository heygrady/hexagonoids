export type FitnessAggregator = (scores: readonly number[]) => number

export const arithmeticMean: FitnessAggregator = (scores) => {
  if (scores.length === 0) {
    throw new Error('Cannot aggregate an empty score set')
  }

  return scores.reduce((sum, score) => sum + score, 0) / scores.length
}

export async function evaluateOrganismMultiSeed(
  seeds: readonly string[],
  evaluateSingleSeed: (seed: string) => Promise<number>,
  aggregate: FitnessAggregator = arithmeticMean
): Promise<number> {
  if (seeds.length === 0) {
    throw new Error('seeds must contain at least one value')
  }

  const scores = await Promise.all(
    seeds.map(async (seed) => await evaluateSingleSeed(seed))
  )

  return aggregate(scores)
}
