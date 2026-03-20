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
import {
  defaultPopulationOptions,
  type PopulationOptions,
} from '@neat-evolution/evolution'
import type { EvolutionManagerOptions } from '@neat-evolution/evolution-manager'

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
const DEFAULT_ENVIRONMENT_PATHNAME = '@heygrady/tictactoe-environment'

export interface CreateTictactoeManagerConfigOptions {
  algorithm: SupportedAlgorithm
  createEnvironmentPathname?: string | undefined
  environmentConfig?: Partial<TicTacToeEnvironmentConfig>
  populationOptions?: Partial<PopulationOptions>
  genomeOptions?: Record<string, unknown>
  neatOptions?: Record<string, unknown>
  strategyOptions?: Partial<GlickoStrategyOptions<any>>
  populationFactoryOptions?: NonNullable<
    EvolutionManagerOptions['population']
  >['factoryOptions']
}

type TictactoeAlgorithmOptions = EvolutionManagerOptions['algorithm']

export function buildTictactoeGenomeOptions(
  algorithmName: SupportedAlgorithm,
  userOptions?: Record<string, unknown>
): unknown {
  const definition = getAlgorithmDefinition(algorithmName)
  const defaults = definition.createDefaultGenomeOptions() as Record<
    string,
    unknown
  >

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

function createAlgorithmOptions(
  algorithmName: SupportedAlgorithm,
  userGenomeOptions?: Record<string, unknown>,
  savedNeatOptions?: Record<string, unknown>
): TictactoeAlgorithmOptions {
  const genomeOptions = buildTictactoeGenomeOptions(
    algorithmName,
    userGenomeOptions
  ) as TictactoeAlgorithmOptions['genomeOptions']
  const neatOptions = {
    ...defaultNEATConfigOptions,
    mutateOnlyOneLink: false,
    ...savedNeatOptions,
  }

  switch (algorithmName) {
    case 'NEAT':
    case 'CPPN':
    case 'HyperNEAT':
    case 'ES-HyperNEAT':
      return {
        name: algorithmName,
        configData: { neat: neatOptions },
        ...(genomeOptions != null ? { genomeOptions } : {}),
      }
    case 'DES-HyperNEAT':
      return {
        name: algorithmName,
        configData: {
          neat: { ...defaultTopologyConfigOptions },
          cppn: neatOptions,
        } as never,
        ...(genomeOptions != null ? { genomeOptions } : {}),
      }
  }
}

export function createTictactoeManagerConfig(
  options: CreateTictactoeManagerConfigOptions
): EvolutionManagerOptions {
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
    algorithm: createAlgorithmOptions(
      options.algorithm,
      options.genomeOptions,
      options.neatOptions
    ),
    environment: {
      config: environment,
      pathname:
        options.createEnvironmentPathname ?? DEFAULT_ENVIRONMENT_PATHNAME,
    },
    population: {
      options: {
        populationSize: DEFAULT_POPULATION_SIZE,
        ...options.populationOptions,
      },
      ...(options.populationFactoryOptions != null
        ? {
            factoryOptions: options.populationFactoryOptions,
          }
        : {}),
    },
    evaluation: {
      strategy,
    },
  }
}
