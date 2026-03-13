import type {
  EvaluationContext,
  EvaluationStrategy,
} from '@neat-evolution/evaluation-strategy'
import type {
  AnyGenome,
  FitnessData,
  GenomeEntries,
} from '@neat-evolution/evaluator'

import {
  evaluateOrganismMultiSeed,
  type FitnessAggregator,
} from './evaluation/evaluateOrganism.js'
import { mean } from './evaluation/metrics.js'
import { generationSeedPack } from './evaluation/seedSchedule.js'

export class MultiSeedGenerationStrategy
  implements EvaluationStrategy<AnyGenome>
{
  private generation = 0
  private readonly seedsPerOrganism: number
  private readonly baseSeed: string
  private readonly aggregate: FitnessAggregator
  private readonly delegateStrategy: EvaluationStrategy<AnyGenome> | undefined

  constructor(
    seedsPerOrganism: number,
    baseSeed: string,
    aggregate: FitnessAggregator = mean,
    delegateStrategy?: EvaluationStrategy<AnyGenome>
  ) {
    this.seedsPerOrganism = seedsPerOrganism
    this.baseSeed = baseSeed
    this.aggregate = aggregate
    this.delegateStrategy = delegateStrategy
  }

  async *evaluate(
    context: EvaluationContext<AnyGenome>,
    genomeEntries: GenomeEntries<AnyGenome>
  ): AsyncIterable<FitnessData> {
    const generation = this.generation
    this.generation += 1
    const entries = Array.from(genomeEntries)
    if (entries.length === 0) {
      return
    }

    const seeds = generationSeedPack(
      generation,
      this.seedsPerOrganism,
      this.baseSeed
    )
    if (this.delegateStrategy == null) {
      for (const entry of entries) {
        const [speciesIndex, organismIndex] = entry
        const fitness = await evaluateOrganismMultiSeed(
          seeds,
          async (seed) => {
            const [, , score] = await context.evaluateGenomeEntry(entry, seed)
            return score
          },
          this.aggregate
        )
        yield [speciesIndex, organismIndex, fitness] as FitnessData
      }
      return
    }

    const seedScores = entries.map(() => [] as number[])
    for (const seed of seeds) {
      const seededContext: EvaluationContext<AnyGenome> = {
        ...context,
        evaluateGenomeEntry: (entry, customSeed) =>
          context.evaluateGenomeEntry(entry, customSeed ?? seed),
        evaluateGenomeEntryBatch: (batch, customSeed) =>
          context.evaluateGenomeEntryBatch(batch, customSeed ?? seed),
      }

      let index = 0
      for await (const fitnessData of this.delegateStrategy.evaluate(
        seededContext,
        entries.values()
      )) {
        seedScores[index]?.push(fitnessData[2])
        index += 1
      }
    }

    for (let index = 0; index < entries.length; index += 1) {
      const [speciesIndex, organismIndex] = entries[index]!
      const scores = seedScores[index] ?? []
      const fitness = this.aggregate(scores)
      yield [speciesIndex, organismIndex, fitness] as FitnessData
    }
  }
}
