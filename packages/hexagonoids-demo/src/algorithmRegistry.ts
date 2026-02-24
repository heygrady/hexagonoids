import { defaultNEATConfigOptions } from '@neat-evolution/core'
import {
  CPPNAlgorithm,
  type CPPNReproducerFactory,
  createConfig as createCPPNConfig,
  createGenome as createCPPNGenome,
  createPhenotype as createCPPNPhenotype,
  createPopulation as createCPPNPopulation,
  createState as createCPPNState,
  defaultCPPNGenomeOptions,
} from '@neat-evolution/cppn'
import {
  createConfig as createDESHyperNEATConfig,
  createGenome as createDESHyperNEATGenome,
  createPhenotype as createDESHyperNEATPhenotype,
  createPopulation as createDESHyperNEATPopulation,
  createState as createDESHyperNEATState,
  DESHyperNEATAlgorithm,
  type DESHyperNEATReproducerFactory,
  defaultDESHyperNEATGenomeOptions,
  defaultTopologyConfigOptions,
} from '@neat-evolution/des-hyperneat'
import type { Environment } from '@neat-evolution/environment'
import {
  createConfig as createESHyperNEATConfig,
  createGenome as createESHyperNEATGenome,
  createPhenotype as createESHyperNEATPhenotype,
  createPopulation as createESHyperNEATPopulation,
  createState as createESHyperNEATState,
  defaultESHyperNEATGenomeOptions,
  ESHyperNEATAlgorithm,
  type ESHyperNEATReproducerFactory,
} from '@neat-evolution/es-hyperneat'
import type { Evaluator } from '@neat-evolution/evaluator'
import { defaultPopulationOptions } from '@neat-evolution/evolution'
import type { Executor, SyncExecutor } from '@neat-evolution/executor'
import {
  createConfig as createHyperNEATConfig,
  createGenome as createHyperNEATGenome,
  createPhenotype as createHyperNEATPhenotype,
  createPopulation as createHyperNEATPopulation,
  createState as createHyperNEATState,
  defaultHyperNEATGenomeOptions,
  HyperNEATAlgorithm,
  type HyperNEATReproducerFactory,
} from '@neat-evolution/hyperneat'
import {
  createConfig as createNEATConfig,
  createGenome as createNEATGenome,
  createPhenotype as createNEATPhenotype,
  createPopulation as createNEATPopulation,
  createState as createNEATState,
  defaultNEATGenomeOptions,
  NEATAlgorithm,
  type NEATReproducerFactory,
} from '@neat-evolution/neat'
import type { RNG } from '@neat-evolution/utils'

export interface AlgorithmIO {
  inputs: number
  outputs: number
}

export type SupportedAlgorithm =
  | 'NEAT'
  | 'CPPN'
  | 'HyperNEAT'
  | 'ES-HyperNEAT'
  | 'DES-HyperNEAT'

export type AlgorithmFactory =
  | typeof NEATAlgorithm
  | typeof CPPNAlgorithm
  | typeof HyperNEATAlgorithm
  | typeof ESHyperNEATAlgorithm
  | typeof DESHyperNEATAlgorithm

export type AlgorithmPopulation =
  | ReturnType<typeof createNEATPopulation>
  | ReturnType<typeof createCPPNPopulation>
  | ReturnType<typeof createHyperNEATPopulation>
  | ReturnType<typeof createESHyperNEATPopulation>
  | ReturnType<typeof createDESHyperNEATPopulation>

export type AnyReproducerFactory =
  | NEATReproducerFactory
  | CPPNReproducerFactory
  | HyperNEATReproducerFactory
  | ESHyperNEATReproducerFactory
  | DESHyperNEATReproducerFactory

export interface AlgorithmDefinition {
  method: SupportedAlgorithm
  createAlgorithm: () => AlgorithmFactory
  createPopulation: (size: number, io: AlgorithmIO) => AlgorithmPopulation
  usesCPPNActivations: boolean
}

export interface TrainingPopulationOptions {
  createReproducer: AnyReproducerFactory
  evaluator: Evaluator<unknown>
  populationSize: number
}

export interface SerializedGenome {
  config: unknown
  state: unknown
  genomeOptions?: Record<string, unknown> | undefined
  factoryOptions?: unknown
}

export const HEXAGONOIDS_IO: AlgorithmIO = {
  inputs: 30,
  outputs: 4,
}

const cloneDefaultOptions = <T>(defaults: T): T => structuredClone(defaults)

const createEvaluatorStub = (
  io: AlgorithmIO
): Evaluator<Record<string, never>> => {
  const environment = {
    description: io,
    isAsync: false,
    evaluate: (_executor: SyncExecutor, _rng?: RNG) => 0,
    evaluateBatch: (_executors: SyncExecutor[], _rng?: RNG) => [],
    evaluateAsync: async (_executor: Executor, _rng?: RNG) => 0,
    evaluateBatchAsync: async (_executors: Executor[], _rng?: RNG) => [],
    toFactoryOptions: () => ({}),
  } satisfies Environment<Record<string, never>>

  return {
    environment,
    initGenomeFactory: async () => {},
    evaluate: async function* (_genomeEntries) {
      // The constructor only needs the evaluator shape; this iterator is unused in registry tests.
    },
  } satisfies Evaluator<Record<string, never>>
}

const createPopulationOptions = (size: number) => {
  return {
    ...defaultPopulationOptions,
    populationSize: size,
  }
}

const createNEATReproducerStub: NEATReproducerFactory = (_population) => ({
  copyElites: async (_speciesIds: number[]) => [],
  reproduce: async (_speciesIds: number[]) => [],
})

const createCPPNReproducerStub: CPPNReproducerFactory = (_population) => ({
  copyElites: async (_speciesIds: number[]) => [],
  reproduce: async (_speciesIds: number[]) => [],
})

const createHyperNEATReproducerStub: HyperNEATReproducerFactory = (
  _population
) => ({
  copyElites: async (_speciesIds: number[]) => [],
  reproduce: async (_speciesIds: number[]) => [],
})

const createESHyperNEATReproducerStub: ESHyperNEATReproducerFactory = (
  _population
) => ({
  copyElites: async (_speciesIds: number[]) => [],
  reproduce: async (_speciesIds: number[]) => [],
})

const createDESHyperNEATReproducerStub: DESHyperNEATReproducerFactory = (
  _population
) => ({
  copyElites: async (_speciesIds: number[]) => [],
  reproduce: async (_speciesIds: number[]) => [],
})

const algorithmRegistry: Record<SupportedAlgorithm, AlgorithmDefinition> = {
  NEAT: {
    method: 'NEAT',
    createAlgorithm: () => NEATAlgorithm,
    createPopulation: (size, io) => {
      return createNEATPopulation(
        createNEATReproducerStub,
        createEvaluatorStub(io),
        defaultNEATConfigOptions,
        createPopulationOptions(size),
        cloneDefaultOptions(defaultNEATGenomeOptions)
      )
    },
    usesCPPNActivations: false,
  },
  CPPN: {
    method: 'CPPN',
    createAlgorithm: () => CPPNAlgorithm,
    createPopulation: (size, io) => {
      return createCPPNPopulation(
        createCPPNReproducerStub,
        createEvaluatorStub(io),
        defaultNEATConfigOptions,
        createPopulationOptions(size),
        cloneDefaultOptions(defaultCPPNGenomeOptions)
      )
    },
    usesCPPNActivations: true,
  },
  HyperNEAT: {
    method: 'HyperNEAT',
    createAlgorithm: () => HyperNEATAlgorithm,
    createPopulation: (size, io) => {
      return createHyperNEATPopulation(
        createHyperNEATReproducerStub,
        createEvaluatorStub(io),
        defaultNEATConfigOptions,
        createPopulationOptions(size),
        {
          ...cloneDefaultOptions(defaultHyperNEATGenomeOptions),
          inputConfig: 'line',
          outputConfig: 'line',
        }
      )
    },
    usesCPPNActivations: true,
  },
  'ES-HyperNEAT': {
    method: 'ES-HyperNEAT',
    createAlgorithm: () => ESHyperNEATAlgorithm,
    createPopulation: (size, io) => {
      return createESHyperNEATPopulation(
        createESHyperNEATReproducerStub,
        createEvaluatorStub(io),
        defaultNEATConfigOptions,
        createPopulationOptions(size),
        {
          ...cloneDefaultOptions(defaultESHyperNEATGenomeOptions),
          inputConfig: 'line',
          outputConfig: 'line',
        }
      )
    },
    usesCPPNActivations: true,
  },
  'DES-HyperNEAT': {
    method: 'DES-HyperNEAT',
    createAlgorithm: () => DESHyperNEATAlgorithm,
    createPopulation: (size, io) => {
      return createDESHyperNEATPopulation(
        createDESHyperNEATReproducerStub,
        createEvaluatorStub(io),
        cloneDefaultOptions(defaultTopologyConfigOptions),
        defaultNEATConfigOptions,
        createPopulationOptions(size),
        {
          ...cloneDefaultOptions(defaultDESHyperNEATGenomeOptions),
          inputConfig: 'line',
          outputConfig: 'line',
        }
      )
    },
    usesCPPNActivations: true,
  },
}

export const SUPPORTED_ALGORITHMS: SupportedAlgorithm[] = [
  'NEAT',
  'CPPN',
  'HyperNEAT',
  'ES-HyperNEAT',
  'DES-HyperNEAT',
]

export const getAlgorithmDefinition = (
  method: SupportedAlgorithm
): AlgorithmDefinition => {
  return algorithmRegistry[method]
}

export const getAlgorithmDefinitions =
  (): ReadonlyArray<AlgorithmDefinition> => {
    return SUPPORTED_ALGORITHMS.map((method) => algorithmRegistry[method])
  }

export const createPopulationForTraining = (
  method: SupportedAlgorithm,
  options: TrainingPopulationOptions
): AlgorithmPopulation => {
  const populationOptions = createPopulationOptions(options.populationSize)
  const neatOptions = defaultNEATConfigOptions

  switch (method) {
    case 'NEAT':
      return createNEATPopulation(
        options.createReproducer as NEATReproducerFactory,
        options.evaluator,
        neatOptions,
        populationOptions,
        cloneDefaultOptions(defaultNEATGenomeOptions)
      )
    case 'CPPN':
      return createCPPNPopulation(
        options.createReproducer as CPPNReproducerFactory,
        options.evaluator,
        neatOptions,
        populationOptions,
        cloneDefaultOptions(defaultCPPNGenomeOptions)
      )
    case 'HyperNEAT':
      return createHyperNEATPopulation(
        options.createReproducer as HyperNEATReproducerFactory,
        options.evaluator,
        neatOptions,
        populationOptions,
        {
          ...cloneDefaultOptions(defaultHyperNEATGenomeOptions),
          inputConfig: 'line',
          outputConfig: 'line',
        }
      )
    case 'ES-HyperNEAT':
      return createESHyperNEATPopulation(
        options.createReproducer as ESHyperNEATReproducerFactory,
        options.evaluator,
        neatOptions,
        populationOptions,
        {
          ...cloneDefaultOptions(defaultESHyperNEATGenomeOptions),
          inputConfig: 'line',
          outputConfig: 'line',
        }
      )
    case 'DES-HyperNEAT':
      return createDESHyperNEATPopulation(
        options.createReproducer as DESHyperNEATReproducerFactory,
        options.evaluator,
        cloneDefaultOptions(defaultTopologyConfigOptions),
        neatOptions,
        populationOptions,
        {
          ...cloneDefaultOptions(defaultDESHyperNEATGenomeOptions),
          inputConfig: 'line',
          outputConfig: 'line',
        }
      )
  }
}

export const createGenomeFromSerialized = (
  method: SupportedAlgorithm,
  genomeData: SerializedGenome,
  initConfig: unknown
): unknown => {
  switch (method) {
    case 'NEAT':
      return createNEATGenome(
        createNEATConfig(genomeData.config as never),
        createNEATState(genomeData.state as never),
        genomeData.genomeOptions as never,
        initConfig as never,
        genomeData.factoryOptions as never
      )
    case 'CPPN':
      return createCPPNGenome(
        createCPPNConfig(genomeData.config as never),
        createCPPNState(genomeData.state as never),
        genomeData.genomeOptions as never,
        initConfig as never,
        genomeData.factoryOptions as never
      )
    case 'HyperNEAT':
      return createHyperNEATGenome(
        createHyperNEATConfig(genomeData.config as never),
        createHyperNEATState(genomeData.state as never),
        genomeData.genomeOptions as never,
        initConfig as never,
        genomeData.factoryOptions as never
      )
    case 'ES-HyperNEAT':
      return createESHyperNEATGenome(
        createESHyperNEATConfig(genomeData.config as never),
        createESHyperNEATState(genomeData.state as never),
        genomeData.genomeOptions as never,
        initConfig as never,
        genomeData.factoryOptions as never
      )
    case 'DES-HyperNEAT':
      return createDESHyperNEATGenome(
        createDESHyperNEATConfig(genomeData.config as never),
        createDESHyperNEATState(genomeData.state as never),
        genomeData.genomeOptions as never,
        initConfig as never,
        genomeData.factoryOptions as never
      )
  }
}

export const createPhenotypeForGenome = (
  method: SupportedAlgorithm,
  genome: unknown
): unknown => {
  switch (method) {
    case 'NEAT':
      return createNEATPhenotype(genome as never)
    case 'CPPN':
      return createCPPNPhenotype(genome as never)
    case 'HyperNEAT':
      return createHyperNEATPhenotype(genome as never)
    case 'ES-HyperNEAT':
      return createESHyperNEATPhenotype(genome as never)
    case 'DES-HyperNEAT':
      return createDESHyperNEATPhenotype(genome as never)
  }
}
