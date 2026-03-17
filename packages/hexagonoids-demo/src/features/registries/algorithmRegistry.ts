import { INPUT_COUNT } from '@heygrady/hexagonoids-environment'
import { Activation, type Phenotype } from '@neat-evolution/core'
import {
  defaultDESHyperNEATGenomeOptions,
  type DESHyperNEATGenomeOptions,
} from '@neat-evolution/des-hyperneat'
import type {
  AnyErasedAlgorithm,
  AnyErasedGenome,
} from '@neat-evolution/evaluator'
import {
  createBuiltInGenomeFromSerialized,
  createBuiltInPhenotypeForGenome,
  getBuiltInEvolutionAlgorithmDefinition,
  getBuiltInEvolutionAlgorithmDefinitions,
  SUPPORTED_EVOLUTION_ALGORITHMS,
  type BuiltInEvolutionAlgorithmDefinition,
  type BuiltInEvolutionAlgorithmName,
  type SerializedGenomeData,
} from '@neat-evolution/evolution-manager'
import {
  defaultCPPNGenomeOptions,
  type CPPNGenomeOptions,
} from '@neat-evolution/cppn'
import {
  defaultESHyperNEATGenomeOptions,
  type ESHyperNEATGenomeOptions,
} from '@neat-evolution/es-hyperneat'
import {
  defaultHyperNEATGenomeOptions,
  type HyperNEATGenomeOptions,
} from '@neat-evolution/hyperneat'
import {
  defaultNEATConfigOptions,
  type NEATConfigOptions,
} from '@neat-evolution/core'
import {
  defaultNEATGenomeOptions,
  type NEATGenomeOptions,
} from '@neat-evolution/neat'

export interface AlgorithmIO {
  inputs: number
  outputs: number
}

export type SupportedAlgorithm = BuiltInEvolutionAlgorithmName
export type SerializedGenome = SerializedGenomeData

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
  addNodeProbability: 0.06,
  addLinkProbability: 0.2,
  removeNodeProbability: 0.006,
  removeLinkProbability: 0.08,
  initialLinkWeightSize: 0.5,
  mutateLinkWeightProbability: 0.9,
  mutateLinkWeightSize: 0.5,
  mutateOnlyOneLink: true,
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

const HEXAGONOIDS_CPPN_MUTATIONS = {
  mutateHiddenBiasProbability: 0.8,
  mutateHiddenBiasSize: 0.03,
  mutateOutputBiasProbability: 0.8,
  mutateOutputBiasSize: 0.03,
  mutateHiddenActivationProbability: 0.1,
  mutateOutputActivationProbability: 0.1,
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
      weightThreshold: 0.1,
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

function toAlgorithmDefinition(
  definition: BuiltInEvolutionAlgorithmDefinition
): AlgorithmDefinition {
  return {
    method: definition.name,
    createAlgorithm: () => definition.algorithm as AnyErasedAlgorithm,
    createGenomeFromSerialized: (genomeData, initConfig) =>
      definition.createGenomeFromSerialized(genomeData, initConfig),
    createPhenotypeForGenome: (genome) =>
      definition.createPhenotypeForGenome(genome),
    usesCPPNActivations: definition.usesCPPNActivations,
  }
}

export const SUPPORTED_ALGORITHMS: SupportedAlgorithm[] = [
  ...SUPPORTED_EVOLUTION_ALGORITHMS,
]

export const getAlgorithmDefinition = (
  method: SupportedAlgorithm
): AlgorithmDefinition => {
  return toAlgorithmDefinition(getBuiltInEvolutionAlgorithmDefinition(method))
}

export const getAlgorithmDefinitions =
  (): ReadonlyArray<AlgorithmDefinition> => {
    return getBuiltInEvolutionAlgorithmDefinitions().map(toAlgorithmDefinition)
  }

export const createGenomeFromSerialized = (
  method: SupportedAlgorithm,
  genomeData: SerializedGenome,
  initConfig: unknown
): AnyErasedGenome => {
  return createBuiltInGenomeFromSerialized(method, genomeData, initConfig)
}

export const createPhenotypeForGenome = (
  method: SupportedAlgorithm,
  genome: AnyErasedGenome
): Phenotype => {
  return createBuiltInPhenotypeForGenome(method, genome)
}
