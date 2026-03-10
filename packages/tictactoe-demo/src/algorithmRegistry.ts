import { Activation, defaultNEATConfigOptions } from '@neat-evolution/core'
import {
  CPPNAlgorithm,
  createPopulation as createCPPNPopulation,
  defaultCPPNGenomeOptions,
} from '@neat-evolution/cppn'
import {
  createPopulation as createDESHyperNEATPopulation,
  DESHyperNEATAlgorithm,
  defaultDESHyperNEATGenomeOptions,
  type TopologyConfigOptions,
} from '@neat-evolution/des-hyperneat'
import {
  createPopulation as createESHyperNEATPopulation,
  defaultESHyperNEATGenomeOptions,
  ESHyperNEATAlgorithm,
} from '@neat-evolution/es-hyperneat'
import type {
  ErasedAlgorithmDefinition,
  PopulationFactoryOptions,
  Population,
  PopulationOptions,
  ReproducerFactory,
} from '@neat-evolution/evolution'
import type { Evaluator } from '@neat-evolution/evaluator'
import {
  createPopulation as createHyperNEATPopulation,
  defaultHyperNEATGenomeOptions,
  HyperNEATAlgorithm,
} from '@neat-evolution/hyperneat'
import {
  createPopulation as createNEATPopulation,
  defaultNEATGenomeOptions,
  NEATAlgorithm,
} from '@neat-evolution/neat'

import type { AnyAlgorithm } from './types.js'

/**
 * Supported algorithm types.
 */
export type SupportedAlgorithm =
  | 'NEAT'
  | 'CPPN'
  | 'HyperNEAT'
  | 'ES-HyperNEAT'
  | 'DES-HyperNEAT'

/**
 * All available activation functions for CPPN-based algorithms.
 */
export const allActivations: Activation[] = [
  Activation.Linear,
  Activation.Step,
  Activation.ReLU,
  Activation.LeakyReLU,
  Activation.ELU,
  Activation.Sigmoid,
  Activation.Swish,
  Activation.HardSigmoid,
  Activation.Tanh,
  Activation.HardTanh,
  Activation.Gaussian,
  Activation.OffsetGaussian,
  Activation.GELU,
  Activation.Square,
  Activation.Abs,
  Activation.Softsign,
  Activation.Exp,
  Activation.ClippedExp,
  Activation.Softplus,
  Activation.Mish,
]

export interface AlgorithmDefinition {
  algorithm: AnyAlgorithm
  defaultGenomeOptions: unknown
  usesCPPNActivations: boolean
  createPopulation: ErasedAlgorithmDefinition<AlgorithmPopulationConfig>['createPopulation']
}

export interface AlgorithmPopulationConfig {
  neatOptions: typeof defaultNEATConfigOptions
  populationOptions: PopulationOptions
  genomeOptions: any
  populationFactoryOptions?: PopulationFactoryOptions<
    any,
    any,
    any,
    any,
    any,
    any
  >
  topologyConfigOptions?: TopologyConfigOptions
}

const createStandardPopulationWrapper = (
  createPopulationFn: (
    reproducer: ReproducerFactory<Population<any>>,
    evaluator: Evaluator<any>,
    neatOptions: typeof defaultNEATConfigOptions,
    populationOptions: PopulationOptions,
    genomeOptions: any,
    populationFactoryOptions?: PopulationFactoryOptions<
      any,
      any,
      any,
      any,
      any,
      any
    >
  ) => Population<any>
): ErasedAlgorithmDefinition<AlgorithmPopulationConfig>['createPopulation'] => {
  return (
    reproducer,
    evaluator,
    config
  ) => {
    return createPopulationFn(
      reproducer,
      evaluator,
      config.neatOptions,
      config.populationOptions,
      config.genomeOptions,
      config.populationFactoryOptions
    )
  }
}

const registry: Record<SupportedAlgorithm, AlgorithmDefinition> = {
  NEAT: {
    algorithm: NEATAlgorithm,
    defaultGenomeOptions: defaultNEATGenomeOptions,
    usesCPPNActivations: false,
    createPopulation: createStandardPopulationWrapper(createNEATPopulation),
  },
  CPPN: {
    algorithm: CPPNAlgorithm,
    defaultGenomeOptions: defaultCPPNGenomeOptions,
    usesCPPNActivations: true,
    createPopulation: createStandardPopulationWrapper(createCPPNPopulation),
  },
  HyperNEAT: {
    algorithm: HyperNEATAlgorithm,
    defaultGenomeOptions: defaultHyperNEATGenomeOptions,
    usesCPPNActivations: true,
    createPopulation: createStandardPopulationWrapper(
      createHyperNEATPopulation
    ),
  },
  'ES-HyperNEAT': {
    algorithm: ESHyperNEATAlgorithm,
    defaultGenomeOptions: defaultESHyperNEATGenomeOptions,
    usesCPPNActivations: true,
    createPopulation: createStandardPopulationWrapper(
      createESHyperNEATPopulation
    ),
  },
  'DES-HyperNEAT': {
    algorithm: DESHyperNEATAlgorithm,
    defaultGenomeOptions: defaultDESHyperNEATGenomeOptions,
    usesCPPNActivations: true,
    createPopulation: (
      reproducer,
      evaluator,
      {
        topologyConfigOptions,
        neatOptions,
        populationOptions,
        genomeOptions,
        // populationFactoryOptions, // Not supported yet
      }
    ) => {
      if (topologyConfigOptions == null) {
        throw new Error(
          'topologyConfigOptions is required for DES-HyperNEAT population creation'
        )
      }
      return createDESHyperNEATPopulation(
        reproducer,
        evaluator,
        topologyConfigOptions,
        neatOptions,
        populationOptions,
        genomeOptions
      )
    },
  },
}

export const getAlgorithmDefinition = (
  algorithm: SupportedAlgorithm
): AlgorithmDefinition => {
  const definition = registry[algorithm]
  return definition
}
