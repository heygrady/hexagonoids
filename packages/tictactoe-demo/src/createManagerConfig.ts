import {
  createEnvironment,
  type TicTacToeEnvironmentConfig,
} from '@heygrady/tictactoe-environment'
import {
  GlickoStrategy,
  type GlickoStrategyOptions,
} from '@heygrady/tournament-strategy'
import { Activation, defaultNEATConfigOptions } from '@neat-evolution/core'
import { defaultTopologyConfigOptions } from '@neat-evolution/des-hyperneat'
import { defaultPopulationOptions, type PopulationOptions } from '@neat-evolution/evolution'
import type { EvolutionManagerConfig } from '@neat-evolution/evolution-manager'

import {
  allActivations,
  getAlgorithmDefinition,
  type SupportedAlgorithm,
} from './algorithmRegistry.js'
import {
  defaultEnvironmentConfig,
  defaultStrategyOptions,
  normalizationRanges,
} from './configDefaults.js'

export const DEFAULT_POPULATION_SIZE = defaultPopulationOptions.populationSize

export interface CreateTictactoeManagerConfigOptions {
  algorithm: SupportedAlgorithm
  environmentConfig?: Partial<TicTacToeEnvironmentConfig>
  populationOptions?: Partial<PopulationOptions>
  genomeOptions?: Record<string, unknown>
  neatOptions?: Record<string, unknown>
  strategyOptions?: Partial<GlickoStrategyOptions<any>>
  populationFactoryOptions?: EvolutionManagerConfig['populationFactoryOptions']
}

type TictactoeManagerBaseConfig = Pick<
  EvolutionManagerConfig,
  | 'algorithm'
  | 'configData'
  | 'genomeOptions'
  | 'environment'
  | 'strategy'
  | 'populationOptions'
  | 'populationFactoryOptions'
>

type ErasedAlgorithmConfig = Pick<
  EvolutionManagerConfig,
  'algorithm' | 'configData' | 'genomeOptions'
>

export function buildTictactoeGenomeOptions(
  algorithmName: SupportedAlgorithm,
  userOptions?: Record<string, unknown>
): unknown {
  const definition = getAlgorithmDefinition(algorithmName)
  const defaults = definition.defaultGenomeOptions as Record<string, unknown>

  const activationOptions = definition.usesCPPNActivations
    ? {
        hiddenActivations: allActivations,
        outputActivations: [Activation.Softmax],
      }
    : {
        hiddenActivation:
          (userOptions?.hiddenActivation as Activation | undefined) ??
          Activation.GELU,
        outputActivation:
          (userOptions?.outputActivation as Activation | undefined) ??
          Activation.Softmax,
      }

  return { ...defaults, ...activationOptions, ...userOptions }
}

function createAlgorithmConfig(
  algorithmName: SupportedAlgorithm,
  userGenomeOptions?: Record<string, unknown>,
  savedNeatOptions?: Record<string, unknown>
): ErasedAlgorithmConfig {
  const genomeOptions = buildTictactoeGenomeOptions(
    algorithmName,
    userGenomeOptions
  )
  const neatOptions = {
    ...defaultNEATConfigOptions,
    mutateOnlyOneLink: false,
    ...savedNeatOptions,
  }

  switch (algorithmName) {
    case 'NEAT':
      return {
        algorithm: getAlgorithmDefinition('NEAT').algorithm,
        configData: { neat: neatOptions },
        genomeOptions,
      } as unknown as ErasedAlgorithmConfig
    case 'CPPN':
      return {
        algorithm: getAlgorithmDefinition('CPPN').algorithm,
        configData: { neat: neatOptions },
        genomeOptions,
      } as unknown as ErasedAlgorithmConfig
    case 'HyperNEAT':
      return {
        algorithm: getAlgorithmDefinition('HyperNEAT').algorithm,
        configData: { neat: neatOptions },
        genomeOptions,
      } as unknown as ErasedAlgorithmConfig
    case 'ES-HyperNEAT':
      return {
        algorithm: getAlgorithmDefinition('ES-HyperNEAT').algorithm,
        configData: { neat: neatOptions },
        genomeOptions,
      } as unknown as ErasedAlgorithmConfig
    case 'DES-HyperNEAT':
      return {
        algorithm: getAlgorithmDefinition('DES-HyperNEAT').algorithm,
        configData: {
          neat: { ...defaultTopologyConfigOptions },
          cppn: neatOptions,
        },
        genomeOptions,
      } as unknown as ErasedAlgorithmConfig
  }
}

export function createTictactoeManagerConfig(
  options: CreateTictactoeManagerConfigOptions
): TictactoeManagerBaseConfig {
  const environment = createEnvironment({
    ...defaultEnvironmentConfig,
    ...options.environmentConfig,
  })

  const strategy = new GlickoStrategy({
    ...defaultStrategyOptions,
    normalizationRanges,
    onHeroesUpdated: () => {},
    ...options.strategyOptions,
  })

  return {
    ...createAlgorithmConfig(
      options.algorithm,
      options.genomeOptions,
      options.neatOptions
    ),
    environment,
    strategy,
    populationOptions: {
      populationSize: DEFAULT_POPULATION_SIZE,
      ...options.populationOptions,
    },
    ...(options.populationFactoryOptions != null
      ? {
          populationFactoryOptions: options.populationFactoryOptions,
        }
      : {}),
  } as unknown as TictactoeManagerBaseConfig
}
