import { INPUT_COUNT } from '@heygrady/hexagonoids-environment'
import type { Phenotype } from '@neat-evolution/core'
import {
  Activation,
  defaultNEATConfigOptions,
  type NEATConfigOptions,
} from '@neat-evolution/core'
import {
  CPPNAlgorithm,
  type CPPNGenomeOptions,
  type CPPNPopulation,
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
  type DESHyperNEATGenomeOptions,
  type DESHyperNEATPopulation,
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
  type ESHyperNEATGenomeOptions,
  type ESHyperNEATPopulation,
  type ESHyperNEATReproducerFactory,
} from '@neat-evolution/es-hyperneat'
import type {
  AnyErasedAlgorithm,
  AnyErasedGenome,
  Evaluator,
} from '@neat-evolution/evaluator'
import {
  defaultPopulationOptions,
  type Population,
  type ReproducerFactory,
} from '@neat-evolution/evolution'
import type { Executor, SyncExecutor } from '@neat-evolution/executor'
import {
  createConfig as createHyperNEATConfig,
  createGenome as createHyperNEATGenome,
  createPhenotype as createHyperNEATPhenotype,
  createPopulation as createHyperNEATPopulation,
  createState as createHyperNEATState,
  defaultHyperNEATGenomeOptions,
  HyperNEATAlgorithm,
  type HyperNEATGenomeOptions,
  type HyperNEATPopulation,
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
  type NEATGenomeOptions,
  type NEATPopulation,
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
  createAlgorithm: () => AnyErasedAlgorithm
  createPopulation: (size: number, io: AlgorithmIO) => AlgorithmPopulation
  createPopulationForTraining: (
    options: TrainingPopulationOptions
  ) => Population<any>
  createGenomeFromSerialized: (
    genomeData: SerializedGenome,
    initConfig: unknown
  ) => AnyErasedGenome
  createPhenotypeForGenome: (genome: AnyErasedGenome) => Phenotype
  usesCPPNActivations: boolean
}

export interface TrainingPopulationOptions {
  createReproducer: ReproducerFactory<Population<any>>
  evaluator: Evaluator<unknown>
  populationSize: number
}

type PopulationArgs<
  P extends Population<any>,
  C extends (
    createReproducer: ReproducerFactory<P>,
    evaluator: Evaluator<unknown>,
    ...args: any[]
  ) => P,
> = C extends (
  createReproducer: ReproducerFactory<P>,
  evaluator: Evaluator<unknown>,
  ...args: infer A
) => P
  ? A
  : never

export interface SerializedGenome {
  config: unknown
  state: unknown
  genomeOptions?: Record<string, unknown> | undefined
  factoryOptions?: unknown
}

export const HEXAGONOIDS_IO: AlgorithmIO = {
  inputs: INPUT_COUNT,
  outputs: 4,
}

const cloneDefaultOptions = <T>(defaults: T): T => structuredClone(defaults)

export const HEXAGONOIDS_HIDDEN_ACTIVATION = Activation.GELU
export const HEXAGONOIDS_OUTPUT_ACTIVATION = Activation.Sigmoid
export const HEXAGONOIDS_HYPERNEAT_HIDDEN_LAYER_SIZES = [4, 4] as const

export const defaultHexagonoidsNEATConfigOptions: NEATConfigOptions = {
  ...defaultNEATConfigOptions,
  addNodeProbability: 0.06, // default: 0.03
  addLinkProbability: 0.2, // default: 0.2
  removeNodeProbability: 0.006, // default: 0.006
  removeLinkProbability: 0.08, // default: 0.08
  initialLinkWeightSize: 0.5, // default: 0.5
  mutateLinkWeightProbability: 0.9, // default: 0.9
  mutateLinkWeightSize: 0.5, // default: 0.5
  mutateOnlyOneLink: true, // default: true
}

export const createHexagonoidsNEATConfigOptions = (): NEATConfigOptions => {
  return { ...defaultHexagonoidsNEATConfigOptions }
}

export const createHexagonoidsNEATGenomeOptions = (): NEATGenomeOptions => {
  return {
    ...cloneDefaultOptions(defaultNEATGenomeOptions),
    hiddenActivation: HEXAGONOIDS_HIDDEN_ACTIVATION,
    outputActivation: HEXAGONOIDS_OUTPUT_ACTIVATION,
  }
}

/** Shared CPPN mutation overrides (all CPPN-based algorithms). Tune down for fine-tuning. */
const HEXAGONOIDS_CPPN_MUTATIONS = {
  mutateHiddenBiasProbability: 0.8, // default: 0.8
  mutateHiddenBiasSize: 0.03, // default: 0.03
  mutateOutputBiasProbability: 0.8, // default: 0.8
  mutateOutputBiasSize: 0.03, // default: 0.03
  mutateHiddenActivationProbability: 0.1, // default: 0.1
  mutateOutputActivationProbability: 0.1, // default: 0.1
} as const

export const createHexagonoidsCPPNGenomeOptions = (): CPPNGenomeOptions => {
  return {
    ...cloneDefaultOptions(defaultCPPNGenomeOptions),
    outputActivations: [HEXAGONOIDS_OUTPUT_ACTIVATION],
    ...HEXAGONOIDS_CPPN_MUTATIONS,
  }
}

export const createHexagonoidsHyperNEATGenomeOptions =
  (): HyperNEATGenomeOptions => {
    return {
      ...cloneDefaultOptions(defaultHyperNEATGenomeOptions),
      inputConfig: 'line',
      outputConfig: 'line',
      hiddenActivation: HEXAGONOIDS_HIDDEN_ACTIVATION,
      outputActivation: HEXAGONOIDS_OUTPUT_ACTIVATION,
      hiddenLayerSizes: [...HEXAGONOIDS_HYPERNEAT_HIDDEN_LAYER_SIZES],
      weightThreshold: 0.1, // default: 0.1
      ...HEXAGONOIDS_CPPN_MUTATIONS,
    }
  }

export const createHexagonoidsESHyperNEATGenomeOptions =
  (): ESHyperNEATGenomeOptions => {
    return {
      ...cloneDefaultOptions(defaultESHyperNEATGenomeOptions),
      inputConfig: 'line',
      outputConfig: 'line',
      hiddenActivation: HEXAGONOIDS_HIDDEN_ACTIVATION,
      outputActivation: HEXAGONOIDS_OUTPUT_ACTIVATION,
      ...HEXAGONOIDS_CPPN_MUTATIONS,
    }
  }

export const createHexagonoidsDESHyperNEATGenomeOptions =
  (): DESHyperNEATGenomeOptions => {
    return {
      ...cloneDefaultOptions(defaultDESHyperNEATGenomeOptions),
      inputConfig: 'line',
      outputConfig: 'line',
      hiddenActivation: HEXAGONOIDS_HIDDEN_ACTIVATION,
      outputActivation: HEXAGONOIDS_OUTPUT_ACTIVATION,
      ...HEXAGONOIDS_CPPN_MUTATIONS,
    }
  }

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

const createTrainingPopulationFactory = <
  P extends Population<any>,
  A extends unknown[],
>(
  createPopulation: (
    createReproducer: ReproducerFactory<P>,
    evaluator: Evaluator<unknown>,
    ...args: A
  ) => P,
  createArgs: (options: TrainingPopulationOptions) => A
) => {
  return (options: TrainingPopulationOptions): P => {
    const args = createArgs(options) as A
    return createPopulation(
      options.createReproducer as ReproducerFactory<P>,
      options.evaluator,
      ...args
    )
  }
}

const createTypedGenomeHydrator = <G>(
  createGenome: (
    config: any,
    state: any,
    genomeOptions: any,
    initConfig: any,
    factoryOptions?: any
  ) => G,
  createConfig: (config: any) => any,
  createState: (state: any) => any
) => {
  return (genomeData: SerializedGenome, initConfig: unknown): G => {
    return createGenome(
      createConfig(genomeData.config),
      createState(genomeData.state),
      genomeData.genomeOptions,
      initConfig,
      genomeData.factoryOptions
    )
  }
}

const createTypedPhenotypeHydrator = <G>(
  createPhenotype: (genome: G) => Phenotype
) => {
  return (genome: unknown): Phenotype => createPhenotype(genome as G)
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
        createHexagonoidsNEATConfigOptions(),
        createPopulationOptions(size),
        createHexagonoidsNEATGenomeOptions()
      )
    },
    createPopulationForTraining: createTrainingPopulationFactory(
      createNEATPopulation,
      (
        options
      ): PopulationArgs<NEATPopulation, typeof createNEATPopulation> => [
        createHexagonoidsNEATConfigOptions(),
        createPopulationOptions(options.populationSize),
        createHexagonoidsNEATGenomeOptions(),
      ]
    ),
    createGenomeFromSerialized: createTypedGenomeHydrator(
      createNEATGenome,
      createNEATConfig,
      createNEATState
    ),
    createPhenotypeForGenome: createTypedPhenotypeHydrator(createNEATPhenotype),
    usesCPPNActivations: false,
  },
  CPPN: {
    method: 'CPPN',
    createAlgorithm: () => CPPNAlgorithm,
    createPopulation: (size, io) => {
      return createCPPNPopulation(
        createCPPNReproducerStub,
        createEvaluatorStub(io),
        createHexagonoidsNEATConfigOptions(),
        createPopulationOptions(size),
        createHexagonoidsCPPNGenomeOptions()
      )
    },
    createPopulationForTraining: createTrainingPopulationFactory(
      createCPPNPopulation,
      (
        options
      ): PopulationArgs<CPPNPopulation, typeof createCPPNPopulation> => [
        createHexagonoidsNEATConfigOptions(),
        createPopulationOptions(options.populationSize),
        createHexagonoidsCPPNGenomeOptions(),
      ]
    ),
    createGenomeFromSerialized: createTypedGenomeHydrator(
      createCPPNGenome,
      createCPPNConfig,
      createCPPNState
    ),
    createPhenotypeForGenome: createTypedPhenotypeHydrator(createCPPNPhenotype),
    usesCPPNActivations: true,
  },
  HyperNEAT: {
    method: 'HyperNEAT',
    createAlgorithm: () => HyperNEATAlgorithm,
    createPopulation: (size, io) => {
      return createHyperNEATPopulation(
        createHyperNEATReproducerStub,
        createEvaluatorStub(io),
        createHexagonoidsNEATConfigOptions(),
        createPopulationOptions(size),
        createHexagonoidsHyperNEATGenomeOptions()
      )
    },
    createPopulationForTraining: createTrainingPopulationFactory(
      createHyperNEATPopulation,
      (
        options
      ): PopulationArgs<
        HyperNEATPopulation,
        typeof createHyperNEATPopulation
      > => [
        createHexagonoidsNEATConfigOptions(),
        createPopulationOptions(options.populationSize),
        createHexagonoidsHyperNEATGenomeOptions(),
      ]
    ),
    createGenomeFromSerialized: createTypedGenomeHydrator(
      createHyperNEATGenome,
      createHyperNEATConfig,
      createHyperNEATState
    ),
    createPhenotypeForGenome: createTypedPhenotypeHydrator(
      createHyperNEATPhenotype
    ),
    usesCPPNActivations: true,
  },
  'ES-HyperNEAT': {
    method: 'ES-HyperNEAT',
    createAlgorithm: () => ESHyperNEATAlgorithm,
    createPopulation: (size, io) => {
      return createESHyperNEATPopulation(
        createESHyperNEATReproducerStub,
        createEvaluatorStub(io),
        createHexagonoidsNEATConfigOptions(),
        createPopulationOptions(size),
        createHexagonoidsESHyperNEATGenomeOptions()
      )
    },
    createPopulationForTraining: createTrainingPopulationFactory(
      createESHyperNEATPopulation,
      (
        options
      ): PopulationArgs<
        ESHyperNEATPopulation,
        typeof createESHyperNEATPopulation
      > => [
        createHexagonoidsNEATConfigOptions(),
        createPopulationOptions(options.populationSize),
        createHexagonoidsESHyperNEATGenomeOptions(),
      ]
    ),
    createGenomeFromSerialized: createTypedGenomeHydrator(
      createESHyperNEATGenome,
      createESHyperNEATConfig,
      createESHyperNEATState
    ),
    createPhenotypeForGenome: createTypedPhenotypeHydrator(
      createESHyperNEATPhenotype
    ),
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
        createHexagonoidsNEATConfigOptions(),
        createPopulationOptions(size),
        createHexagonoidsDESHyperNEATGenomeOptions()
      )
    },
    createPopulationForTraining: createTrainingPopulationFactory(
      createDESHyperNEATPopulation,
      (
        options
      ): PopulationArgs<
        DESHyperNEATPopulation,
        typeof createDESHyperNEATPopulation
      > => [
        cloneDefaultOptions(defaultTopologyConfigOptions),
        createHexagonoidsNEATConfigOptions(),
        createPopulationOptions(options.populationSize),
        createHexagonoidsDESHyperNEATGenomeOptions(),
      ]
    ),
    createGenomeFromSerialized: createTypedGenomeHydrator(
      createDESHyperNEATGenome,
      createDESHyperNEATConfig,
      createDESHyperNEATState
    ),
    createPhenotypeForGenome: createTypedPhenotypeHydrator(
      createDESHyperNEATPhenotype
    ),
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
  return algorithmRegistry[method].createPopulationForTraining(
    options
  ) as AlgorithmPopulation
}

export const createGenomeFromSerialized = (
  method: SupportedAlgorithm,
  genomeData: SerializedGenome,
  initConfig: unknown
): AnyErasedGenome => {
  return algorithmRegistry[method].createGenomeFromSerialized(
    genomeData,
    initConfig
  )
}

export const createPhenotypeForGenome = (
  method: SupportedAlgorithm,
  genome: AnyErasedGenome
): Phenotype => {
  return algorithmRegistry[method].createPhenotypeForGenome(genome)
}
