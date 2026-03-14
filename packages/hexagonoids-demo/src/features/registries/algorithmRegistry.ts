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
  createConfig as createCPPNConfig,
  createGenome as createCPPNGenome,
  createPhenotype as createCPPNPhenotype,
  createState as createCPPNState,
  defaultCPPNGenomeOptions,
} from '@neat-evolution/cppn'
import {
  createConfig as createDESHyperNEATConfig,
  createGenome as createDESHyperNEATGenome,
  createPhenotype as createDESHyperNEATPhenotype,
  createState as createDESHyperNEATState,
  DESHyperNEATAlgorithm,
  type DESHyperNEATGenomeOptions,
  defaultDESHyperNEATGenomeOptions,
} from '@neat-evolution/des-hyperneat'
import {
  createConfig as createESHyperNEATConfig,
  createGenome as createESHyperNEATGenome,
  createPhenotype as createESHyperNEATPhenotype,
  createState as createESHyperNEATState,
  defaultESHyperNEATGenomeOptions,
  ESHyperNEATAlgorithm,
  type ESHyperNEATGenomeOptions,
} from '@neat-evolution/es-hyperneat'
import type {
  AnyErasedAlgorithm,
  AnyErasedGenome,
} from '@neat-evolution/evaluator'
import {
  createConfig as createHyperNEATConfig,
  createGenome as createHyperNEATGenome,
  createPhenotype as createHyperNEATPhenotype,
  createState as createHyperNEATState,
  defaultHyperNEATGenomeOptions,
  HyperNEATAlgorithm,
  type HyperNEATGenomeOptions,
} from '@neat-evolution/hyperneat'
import {
  createConfig as createNEATConfig,
  createGenome as createNEATGenome,
  createPhenotype as createNEATPhenotype,
  createState as createNEATState,
  defaultNEATGenomeOptions,
  NEATAlgorithm,
  type NEATGenomeOptions,
} from '@neat-evolution/neat'

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

export interface AlgorithmDefinition {
  method: SupportedAlgorithm
  createAlgorithm: () => AnyErasedAlgorithm
  createGenomeFromSerialized: (
    genomeData: SerializedGenome,
    initConfig: unknown
  ) => AnyErasedGenome
  createPhenotypeForGenome: (genome: AnyErasedGenome) => Phenotype
  usesCPPNActivations: boolean
}

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

const algorithmRegistry: Record<SupportedAlgorithm, AlgorithmDefinition> = {
  NEAT: {
    method: 'NEAT',
    createAlgorithm: () => NEATAlgorithm,
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
