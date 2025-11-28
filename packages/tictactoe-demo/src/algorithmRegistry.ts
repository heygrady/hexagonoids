import { Activation } from '@neat-evolution/core'
import {
  CPPNAlgorithm,
  createPopulation as createCPPNPopulation,
  defaultCPPNGenomeOptions,
} from '@neat-evolution/cppn'
import {
  DESHyperNEATAlgorithm,
  createPopulation as createDESHyperNEATPopulation,
  defaultDESHyperNEATGenomeOptions,
  type TopologyConfigOptions,
} from '@neat-evolution/des-hyperneat'
import {
  ESHyperNEATAlgorithm,
  createPopulation as createESHyperNEATPopulation,
  defaultESHyperNEATGenomeOptions,
} from '@neat-evolution/es-hyperneat'
import type { ReproducerFactory } from '@neat-evolution/evolution'
import {
  HyperNEATAlgorithm,
  createPopulation as createHyperNEATPopulation,
  defaultHyperNEATGenomeOptions,
} from '@neat-evolution/hyperneat'
import {
  NEATAlgorithm,
  createPopulation as createNEATPopulation,
  defaultNEATGenomeOptions,
} from '@neat-evolution/neat'

import type { AnyAlgorithm, AnyPopulation } from './types.js'

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
  algorithm: AnyAlgorithm<any>
  defaultGenomeOptions: any
  usesCPPNActivations: boolean
  createPopulation: (
    reproducer: ReproducerFactory<any, any>,
    evaluator: any,
    config: {
      neatOptions: any
      populationOptions: any
      genomeOptions: any
      populationFactoryOptions?: any
      topologyConfigOptions?: TopologyConfigOptions
    }
  ) => AnyPopulation<any>
}

const createStandardPopulationWrapper = (createPopulationFn: any) => {
  return (
    reproducer: ReproducerFactory<any, any>,
    evaluator: any,
    config: {
      neatOptions: any
      populationOptions: any
      genomeOptions: any
      populationFactoryOptions?: any
    }
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
