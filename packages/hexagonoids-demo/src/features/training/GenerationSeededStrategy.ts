import type {
  AnyGenome,
  FitnessData,
  GenomeEntries,
} from '@neat-evolution/core'
import type {
  EvaluationContext,
  EvaluationStrategy,
} from '@neat-evolution/evaluation-strategy'

import { generationSeedPack } from './evaluation/seedSchedule.js'

/**
 * Wraps IndividualStrategy behavior with per-generation deterministic seeds.
 * Each generation gets a unique seed derived from the base seed and generation number,
 * ensuring varied game states across generations while remaining reproducible.
 */
export class GenerationSeededStrategy<G extends AnyGenome = AnyGenome>
  implements EvaluationStrategy<G>
{
  private generation = 0

  constructor(private readonly baseSeed: string) {}

  async *evaluate(
    context: EvaluationContext<G>,
    genomeEntries: GenomeEntries<G>
  ): AsyncIterable<FitnessData> {
    const seed = generationSeedPack(this.generation, 1, this.baseSeed)[0]
    this.generation += 1

    const promises: Array<Promise<FitnessData>> = []

    for (const entry of genomeEntries) {
      promises.push(context.evaluateGenomeEntry(entry, seed))
    }

    while (promises.length > 0) {
      const p = promises.shift()
      if (p != null) {
        yield await p
      }
    }
  }
}
