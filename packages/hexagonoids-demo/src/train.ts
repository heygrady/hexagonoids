import {
  createEnvironment,
  doNothingAgent,
  type RawMetrics,
  randomAgent,
} from '@heygrady/hexagonoids-environment'
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
import type { FitnessData } from '@neat-evolution/evaluator'
import { defaultEvolutionOptions, evolve } from '@neat-evolution/evolution'
import type {
  HyperNEATGenomeOptions,
  HyperNEATReproducerFactory,
} from '@neat-evolution/hyperneat'
import type { NEATGenome, NEATReproducerFactory } from '@neat-evolution/neat'
import { WorkerEvaluator } from '@neat-evolution/worker-evaluator'
import {
  createReproducerFactory,
  type Terminable,
} from '@neat-evolution/worker-reproducer'
import { hardwareConcurrency } from '@neat-evolution/worker-threads'

import type { SupportedAlgorithm } from './algorithmRegistry.js'
import {
  createPopulationForTraining,
  getAlgorithmDefinition,
} from './algorithmRegistry.js'
import { DEMO_DEFAULTS } from './configDefaults.js'
import { summarizeBaselineAgent } from './evaluation/baselines.js'
import {
  evaluateOrganismMultiSeed,
  type FitnessAggregator,
} from './evaluation/evaluateOrganism.js'
import { mean, median } from './evaluation/metrics.js'
import { generationSeedPack } from './evaluation/seedSchedule.js'
import {
  appendHeroesLog,
  type HeroLogEntry,
  resolveHeroesLogPath,
} from './persistence/appendHeroesLog.js'
import { saveGenome } from './persistence/saveGenome.js'

const DEFAULT_METHOD: SupportedAlgorithm = 'NEAT'
const DEFAULT_BASE_SEED = 'hexagonoids-phase03'
const CREATE_ENVIRONMENT_PATHNAME = '@heygrady/hexagonoids-environment'
const CREATE_EXECUTOR_PATHNAME = '@neat-evolution/executor'

class MultiSeedGenerationStrategy {
  private generation = 0
  private readonly seedsPerOrganism: number
  private readonly baseSeed: string
  private readonly aggregate: FitnessAggregator

  constructor(
    seedsPerOrganism: number,
    baseSeed: string,
    aggregate: FitnessAggregator
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
    const pending: Array<Promise<FitnessData>> = []

    for (const entry of genomeEntries) {
      const [speciesIndex, organismIndex] = entry

      const evaluationPromise = evaluateOrganismMultiSeed(
        seeds,
        async (seed) => {
          const [, , fitness] = await context.evaluateGenomeEntry(entry, seed)
          return fitness
        },
        this.aggregate
      ).then((fitness) => [speciesIndex, organismIndex, fitness] as FitnessData)

      pending.push(evaluationPromise)
    }

    while (pending.length > 0) {
      const result = pending.shift()
      if (result != null) {
        yield await result
      }
    }
  }
}

const createReproducerFactoryForMethod = (
  method: SupportedAlgorithm,
  baseOptions: { threadCount: number },
  terminables: Set<Terminable>
) => {
  switch (method) {
    case 'NEAT':
      return createReproducerFactory<NEATGenome>(
        baseOptions,
        terminables
      ) satisfies NEATReproducerFactory
    case 'CPPN':
      return createReproducerFactory<CPPNGenome<CPPNGenomeOptions>>(
        baseOptions,
        terminables
      ) satisfies CPPNReproducerFactory
    case 'HyperNEAT':
      return createReproducerFactory<CPPNGenome<HyperNEATGenomeOptions>>(
        baseOptions,
        terminables
      ) satisfies HyperNEATReproducerFactory
    case 'ES-HyperNEAT':
      return createReproducerFactory<CPPNGenome<ESHyperNEATGenomeOptions>>(
        baseOptions,
        terminables
      ) satisfies ESHyperNEATReproducerFactory
    case 'DES-HyperNEAT':
      return createReproducerFactory<DESHyperNEATGenome>(
        {
          ...baseOptions,
          enableCustomState: true,
        },
        terminables
      ) satisfies DESHyperNEATReproducerFactory
  }
}

const toRunConfig = (options: TrainOptions) => {
  return {
    method: options.method ?? DEFAULT_METHOD,
    populationSize: options.populationSize ?? DEMO_DEFAULTS.populationSize,
    iterations: options.iterations ?? DEMO_DEFAULTS.iterations,
    secondsLimit: options.secondsLimit ?? DEMO_DEFAULTS.secondsLimit,
    earlyStopPatience:
      options.earlyStopPatience ?? DEMO_DEFAULTS.earlyStopPatience,
    evaluationSeedsPerOrganism:
      options.evaluationSeedsPerOrganism ??
      DEMO_DEFAULTS.evaluationSeedsPerOrganism,
    maxTicks: options.maxTicks ?? DEMO_DEFAULTS.maxTicks,
    dtMs: options.dtMs ?? DEMO_DEFAULTS.dtMs,
    baseSeed: options.baseSeed ?? DEFAULT_BASE_SEED,
    outputDir: options.outputDir,
    baselineOnly: options.baselineOnly ?? false,
    logInterval: options.logInterval ?? defaultEvolutionOptions.logInterval,
    threadCount:
      options.threadCount ?? Math.max(1, Math.floor(hardwareConcurrency - 1)),
    signal: options.signal,
  }
}

export interface TrainOptions {
  method?: SupportedAlgorithm | undefined
  baselineOnly?: boolean | undefined
  populationSize?: number | undefined
  iterations?: number | undefined
  secondsLimit?: number | undefined
  earlyStopPatience?: number | undefined
  evaluationSeedsPerOrganism?: number | undefined
  baseSeed?: string | undefined
  maxTicks?: number | undefined
  dtMs?: number | undefined
  outputDir?: string | undefined
  logInterval?: number | undefined
  threadCount?: number | undefined
  signal?: AbortSignal | undefined
}

export interface BaselineRunResult {
  mode: 'baseline'
  method: SupportedAlgorithm
  seeds: string[]
  scores: Array<{
    name: string
    meanFitness: number
    metrics: RawMetrics
  }>
}

export interface TrainingRunResult {
  mode: 'training'
  method: SupportedAlgorithm
  bestFitness: number
  populationFitnessMean: number | null
  populationFitnessMedian: number | null
  bestOrganism: unknown
  bestFilePath: string
  heroesLogPath: string
}

export type TrainResult = BaselineRunResult | TrainingRunResult

export async function train(options: TrainOptions = {}): Promise<TrainResult> {
  const config = toRunConfig(options)
  const method = config.method

  if (config.baselineOnly) {
    const seedPack = generationSeedPack(
      0,
      config.evaluationSeedsPerOrganism,
      config.baseSeed
    )
    const simulation = {
      maxTicks: config.maxTicks,
      dtMs: config.dtMs,
    }

    const scores = [
      summarizeBaselineAgent(
        'doNothingAgent',
        doNothingAgent,
        seedPack,
        simulation
      ),
      summarizeBaselineAgent('randomAgent', randomAgent, seedPack, simulation),
    ]

    const result: BaselineRunResult = {
      mode: 'baseline',
      method,
      seeds: seedPack,
      scores,
    }

    return result
  }

  const terminables = new Set<Terminable>()
  const pendingHeroWrites: Array<
    Promise<{ ok: true } | { ok: false; error: unknown }>
  > = []
  const runStart = Date.now()
  let bestOrganism: unknown
  let bestFitness = Number.NEGATIVE_INFINITY
  let populationFitnessMean: number | null = null
  let populationFitnessMedian: number | null = null

  const environment = createEnvironment({
    simulation: {
      maxTicks: config.maxTicks,
      dtMs: config.dtMs,
    },
  })

  const algorithm = getAlgorithmDefinition(method).createAlgorithm()
  const evaluator = new WorkerEvaluator(algorithm, environment, {
    createEnvironmentPathname: CREATE_ENVIRONMENT_PATHNAME,
    createExecutorPathname: CREATE_EXECUTOR_PATHNAME,
    taskCount: config.populationSize,
    threadCount: config.threadCount,
    strategy: new MultiSeedGenerationStrategy(
      config.evaluationSeedsPerOrganism,
      config.baseSeed,
      mean
    ),
  })
  terminables.add(evaluator)

  const createReproducer = createReproducerFactoryForMethod(
    method,
    {
      threadCount: config.threadCount,
    },
    terminables
  )

  const population = createPopulationForTraining(method, {
    createReproducer,
    evaluator,
    populationSize: config.populationSize,
  })

  const evolutionOptions = {
    ...defaultEvolutionOptions,
    iterations: config.iterations,
    secondsLimit: config.secondsLimit,
    earlyStop: true,
    earlyStopPatience: config.earlyStopPatience,
    logInterval: config.logInterval,
    ...(config.signal != null && {
      signal: config.signal,
    }),
    handleNewBest: (organism: unknown) => {
      bestOrganism = organism
      if (
        organism != null &&
        typeof organism === 'object' &&
        'fitness' in organism &&
        typeof organism.fitness === 'number'
      ) {
        bestFitness = organism.fitness
      }
    },
    afterEvaluate: (_currentPopulation: unknown, iteration: number) => {
      const best = population.best()
      if (best == null) {
        return
      }

      const entry: HeroLogEntry = {
        generation: iteration,
        method,
        bestFitness: best.fitness ?? 0,
        seeds: generationSeedPack(
          iteration,
          config.evaluationSeedsPerOrganism,
          config.baseSeed
        ),
        seedsPerOrganism: config.evaluationSeedsPerOrganism,
        baseSeed: config.baseSeed,
        elapsedMs: Date.now() - runStart,
        timestamp: new Date().toISOString(),
      }

      const write = appendHeroesLog(entry, config.outputDir)
        .then(() => ({ ok: true }) as const)
        .catch((error) => ({ ok: false, error }) as const)
      pendingHeroWrites.push(write)
    },
  }

  try {
    await evolve(population, evolutionOptions)
    const best = bestOrganism ?? population.best()
    if (best == null) {
      throw new Error('No best organism available after evolution run')
    }
    bestOrganism = best

    const heroWriteResults = await Promise.all(pendingHeroWrites)
    const firstFailedWrite = heroWriteResults.find((result) => !result.ok)
    if (firstFailedWrite != null && !firstFailedWrite.ok) {
      const reason =
        firstFailedWrite.error instanceof Error
          ? firstFailedWrite.error.message
          : String(firstFailedWrite.error)
      throw new Error(`Failed to append heroes log: ${reason}`)
    }

    if (
      bestFitness === Number.NEGATIVE_INFINITY &&
      typeof best === 'object' &&
      best != null &&
      'fitness' in best &&
      typeof best.fitness === 'number'
    ) {
      bestFitness = best.fitness
    }

    const fitnessValues: number[] = []
    for (const organism of population.organismValues() as Iterable<{
      fitness: number | null
    }>) {
      if (organism.fitness != null) {
        fitnessValues.push(organism.fitness)
      }
    }
    if (fitnessValues.length > 0) {
      populationFitnessMean = mean(fitnessValues)
      populationFitnessMedian = median(fitnessValues)
    }

    const bestFilePath = await saveGenome(method, best, config.outputDir)

    return {
      mode: 'training',
      method,
      bestFitness,
      populationFitnessMean,
      populationFitnessMedian,
      bestOrganism,
      bestFilePath,
      heroesLogPath: resolveHeroesLogPath(config.outputDir),
    }
  } finally {
    for (const terminable of terminables) {
      await terminable.terminate()
    }
    terminables.clear()
  }
}
