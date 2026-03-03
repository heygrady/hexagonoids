import type {
  CPPNGenome,
  CPPNGenomeOptions,
  CPPNReproducerFactory,
} from '@neat-evolution/cppn'
import type {
  DESHyperNEATGenome,
  DESHyperNEATReproducerFactory,
} from '@neat-evolution/des-hyperneat'
import type {
  ESHyperNEATGenomeOptions,
  ESHyperNEATReproducerFactory,
} from '@neat-evolution/es-hyperneat'
import type { EvaluationStrategy } from '@neat-evolution/evaluation-strategy'
import type { FitnessData } from '@neat-evolution/evaluator'
import type {
  HyperNEATGenomeOptions,
  HyperNEATReproducerFactory,
} from '@neat-evolution/hyperneat'
import type { NEATGenome, NEATReproducerFactory } from '@neat-evolution/neat'
import {
  createReproducerFactory,
  type Terminable,
} from '@neat-evolution/worker-reproducer'

import type { SupportedAlgorithm } from './algorithmRegistry.js'
import {
  evaluateOrganismMultiSeed,
  type FitnessAggregator,
} from './evaluation/evaluateOrganism.js'
import { mean } from './evaluation/metrics.js'
import { generationSeedPack } from './evaluation/seedSchedule.js'

export class MultiSeedGenerationStrategy implements EvaluationStrategy<any> {
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
        entry: [number, number, unknown],
        seed?: string
      ) => Promise<FitnessData>
    },
    genomeEntries: Iterable<[number, number, unknown]>
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

export const createWorkerReproducerFactoryForMethod = (
  method: SupportedAlgorithm,
  baseOptions: {
    threadCount: number
    algorithmPathname?: string | undefined
    workerScriptUrl?: string | undefined
  },
  terminables: Set<Terminable>
) => {
  const workerOptions = baseOptions as any

  switch (method) {
    case 'NEAT':
      return createReproducerFactory<NEATGenome>(
        workerOptions,
        terminables
      ) as unknown as NEATReproducerFactory
    case 'CPPN':
      return createReproducerFactory<CPPNGenome<CPPNGenomeOptions>>(
        workerOptions,
        terminables
      ) as unknown as CPPNReproducerFactory
    case 'HyperNEAT':
      return createReproducerFactory<CPPNGenome<HyperNEATGenomeOptions>>(
        workerOptions,
        terminables
      ) as unknown as HyperNEATReproducerFactory
    case 'ES-HyperNEAT':
      return createReproducerFactory<CPPNGenome<ESHyperNEATGenomeOptions>>(
        workerOptions,
        terminables
      ) as unknown as ESHyperNEATReproducerFactory
    case 'DES-HyperNEAT':
      return createReproducerFactory<DESHyperNEATGenome>(
        {
          ...workerOptions,
          enableCustomState: true,
        },
        terminables
      ) as unknown as DESHyperNEATReproducerFactory
  }
}
