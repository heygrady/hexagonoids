import type { EvaluationStrategy } from '@neat-evolution/evaluation-strategy'
import type {
  AnyGenome,
  FitnessData,
  GenomeEntries,
  GenomeEntry,
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

  constructor(
    seedsPerOrganism: number,
    baseSeed: string,
    aggregate: FitnessAggregator = mean
  ) {
    this.seedsPerOrganism = seedsPerOrganism
    this.baseSeed = baseSeed
    this.aggregate = aggregate
  }

  async *evaluate(
    context: {
      evaluateGenomeEntry: (
        entry: GenomeEntry<AnyGenome>,
        seed?: string
      ) => Promise<FitnessData>
    },
    genomeEntries: GenomeEntries<AnyGenome>
  ): AsyncIterable<FitnessData> {
    const generation = this.generation
    this.generation += 1

    const seeds = generationSeedPack(
      generation,
      this.seedsPerOrganism,
      this.baseSeed
    )
    const pending = new Map<
      number,
      Promise<{ id: number; result: FitnessData }>
    >()
    let nextPendingId = 0

    for (const entry of genomeEntries) {
      const [speciesIndex, organismIndex] = entry
      const pendingId = nextPendingId
      nextPendingId += 1

      const evaluationPromise = evaluateOrganismMultiSeed(
        seeds,
        async (seed) => {
          const [, , fitness] = await context.evaluateGenomeEntry(entry, seed)
          return fitness
        },
        this.aggregate
      ).then((fitness) => ({
        id: pendingId,
        result: [speciesIndex, organismIndex, fitness] as FitnessData,
      }))

      pending.set(pendingId, evaluationPromise)
    }

    while (pending.size > 0) {
      const settled = await Promise.race(pending.values())
      pending.delete(settled.id)
      yield settled.result
    }
  }
}
