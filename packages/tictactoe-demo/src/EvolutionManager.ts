import {
  createEnvironment,
  type TicTacToeEnvironmentConfig,
} from '@heygrady/tictactoe-environment'
import {
  GlickoStrategy,
  type GlickoStrategyOptions,
} from '@heygrady/tournament-strategy'
import { Activation, defaultNEATConfigOptions } from '@neat-evolution/core'
import {
  defaultTopologyConfigOptions,
  type TopologyConfigOptions,
} from '@neat-evolution/des-hyperneat'
import {
  evolve as neatEvolve,
  type EvolutionOptions,
  defaultEvolutionOptions,
  defaultPopulationOptions,
  type PopulationOptions,
  type ReproducerFactory,
  Organism,
} from '@neat-evolution/evolution'
import { createExecutor, type SyncExecutor } from '@neat-evolution/executor'
import { createEvaluator } from '@neat-evolution/worker-evaluator'
import {
  createReproducerFactory,
  type Terminable,
} from '@neat-evolution/worker-reproducer'
import { hardwareConcurrency } from '@neat-evolution/worker-threads'

import {
  getAlgorithmDefinition,
  allActivations,
  type SupportedAlgorithm,
} from './algorithmRegistry.js'
import {
  defaultEnvironmentConfig,
  defaultStrategyOptions,
  normalizationRanges,
} from './configDefaults.js'
import { ModulePathnameKey, type ModulePathnames } from './modulePathnames.js'
import type { AnyAlgorithm, AnyGenome, AnyPopulation } from './types.js'

export { type SupportedAlgorithm } from './algorithmRegistry.js'

const workerEvaluatorThreadLimit = Math.floor(hardwareConcurrency * 0.5)
const workerReproducerThreadLimit = Math.floor(hardwareConcurrency * 0.5)

/**
 * Configuration for EvolutionManager.
 */
export interface EvolutionManagerConfig {
  /** Algorithm to use (NEAT, CPPN, HyperNEAT, ES-HyperNEAT, DES-HyperNEAT) */
  algorithm: SupportedAlgorithm
  /** Module pathnames for worker threads */
  modulePathnames: ModulePathnames
  /** Environment configuration (optional, uses defaults if not provided) */
  environmentConfig?: Partial<TicTacToeEnvironmentConfig>
  /** Evolution options (optional, uses defaults if not provided) */
  evolutionOptions?: Partial<EvolutionOptions<any, any>>
  /** NEAT configuration options (optional, uses defaults if not provided) */
  neatOptions?: Partial<typeof defaultNEATConfigOptions>
  /** Population options (optional, uses defaults if not provided) */
  populationOptions?: Partial<PopulationOptions>
  /** Genome options (optional, uses defaults if not provided) */
  genomeOptions?: any
  /** GlickoStrategy options (optional, uses defaults if not provided) */
  strategyOptions?: Partial<GlickoStrategyOptions<any>>
  /** Population factory options for restoring saved populations (optional) */
  populationFactoryOptions?: any
}

/**
 * EvolutionManager provides a simplified API for managing NEAT evolution
 * in interactive applications.
 *
 * Features:
 * - Single config object API
 * - Baked-in support for 5 algorithms (NEAT, CPPN, HyperNEAT, ES-HyperNEAT, DES-HyperNEAT)
 * - Internal worker management (evaluator and reproducer)
 * - Automatic resource cleanup
 * - Population reset support
 * @example
 * ```typescript
 * const manager = new EvolutionManager({
 *   algorithm: 'NEAT',
 *   modulePathnames,
 *   populationOptions: { populationSize: 150 }
 * })
 *
 * await manager.initializePopulation()
 * await manager.evolve({ iterations: 10 })
 * const executor = manager.getBestExecutor()
 * await manager.terminate()
 * ```
 */
export class EvolutionManager<G extends AnyGenome<G>> {
  /** Current population */
  population: AnyPopulation<G>

  /** Current algorithm type */
  private algorithmType: SupportedAlgorithm
  /** Algorithm instance */
  private algorithm: AnyAlgorithm<G>

  /** Terminable resources (workers) */
  private readonly terminables = new Set<Terminable>()
  /** Module pathnames for worker threads */
  private modulePathnames: ModulePathnames

  /** Evolution options */
  private readonly evolutionOptions: EvolutionOptions<any, any>
  /** NEAT configuration options */
  private readonly neatOptions: typeof defaultNEATConfigOptions
  /** Population options */
  private readonly populationOptions: PopulationOptions
  /** Genome options */
  private genomeOptions: any
  /** Topology config options (for DES-HyperNEAT) */
  private topologyConfigOptions: TopologyConfigOptions
  /** Environment configuration */
  private readonly environmentConfig: Partial<TicTacToeEnvironmentConfig>
  /** GlickoStrategy options */
  private readonly strategyOptions: Partial<GlickoStrategyOptions<any>>
  /** Population factory options for restoring saved populations */
  private populationFactoryOptions?: any

  constructor(config: EvolutionManagerConfig) {
    this.algorithmType = config.algorithm

    const definition = getAlgorithmDefinition(config.algorithm)
    this.algorithm = definition.algorithm as AnyAlgorithm<G>

    this.modulePathnames = config.modulePathnames

    // Store configuration with defaults
    this.evolutionOptions = {
      ...defaultEvolutionOptions,
      ...config.evolutionOptions,
    }
    this.neatOptions = {
      ...defaultNEATConfigOptions,
      mutateOnlyOneLink: false,
      ...config.neatOptions,
    }
    this.populationOptions = {
      ...defaultPopulationOptions,
      ...config.populationOptions,
    }
    this.topologyConfigOptions = {
      ...defaultTopologyConfigOptions,
    }
    this.environmentConfig = config.environmentConfig ?? {}
    this.strategyOptions = config.strategyOptions ?? {}
    this.populationFactoryOptions = config.populationFactoryOptions

    this.configureGenomeOptions(config.algorithm, config.genomeOptions)

    // Create initial population
    this.population = this.createPopulationInternal()
  }

  /**
   * Configures genome options based on the algorithm and provided overrides.
   * @param algorithm The supported algorithm type.
   * @param configGenomeOptions Optional genome options to override defaults.
   */
  private configureGenomeOptions(
    algorithm: SupportedAlgorithm,
    configGenomeOptions?: any
  ) {
    const definition = getAlgorithmDefinition(algorithm)
    const algorithmDefaults = definition.defaultGenomeOptions

    let activationOptions: any
    if (definition.usesCPPNActivations) {
      // CPPN-based algorithms use arrays of activations
      activationOptions = {
        hiddenActivations: allActivations,
        outputActivations: [Activation.Softmax],
      }
    } else {
      // NEAT uses single activation functions
      activationOptions = {
        hiddenActivation:
          configGenomeOptions?.hiddenActivation ?? Activation.GELU,
        outputActivation:
          configGenomeOptions?.outputActivation ?? Activation.Softmax,
      }
    }

    this.genomeOptions = {
      ...algorithmDefaults,
      ...activationOptions,
      ...configGenomeOptions,
    }
  }

  /**
   * Create population with current configuration.
   * @private
   * @returns {AnyPopulation<any>} The created population
   */
  private createPopulationInternal(): AnyPopulation<G> {
    // Create reproducer with terminables tracking
    const createReproducer: ReproducerFactory<any, any> =
      createReproducerFactory(
        {
          algorithmPathname: this.modulePathnames[ModulePathnameKey.ALGORITHM],
          threadCount: workerReproducerThreadLimit,
          enableCustomState: this.algorithmType === 'DES-HyperNEAT',
        },
        this.terminables
      )

    // Merge with provided config
    const finalEnvironmentConfig = {
      ...defaultEnvironmentConfig,
      ...this.environmentConfig,
    }

    const environment = createEnvironment(finalEnvironmentConfig)

    // Create Glicko strategy with defaults and user overrides
    const strategy = new GlickoStrategy<any>({
      // Base defaults
      ...defaultStrategyOptions,
      normalizationRanges,
      onHeroesUpdated: () => {
        // Placeholder for hero tracking in interactive context
      },
      // User-provided overrides (takes precedence)
      ...this.strategyOptions,
    })

    // Create evaluator with worker threads
    const evaluator = createEvaluator(this.algorithm, environment, {
      algorithmPathname: this.modulePathnames[ModulePathnameKey.ALGORITHM],
      createEnvironmentPathname:
        this.modulePathnames[ModulePathnameKey.CREATE_ENVIRONMENT],
      createExecutorPathname:
        this.modulePathnames[ModulePathnameKey.CREATE_EXECUTOR],
      taskCount: this.populationOptions.populationSize,
      threadCount: workerEvaluatorThreadLimit,
      strategy,
    })
    this.terminables.add(evaluator as any)

    const definition = getAlgorithmDefinition(this.algorithmType)
    return definition.createPopulation(createReproducer, evaluator, {
      neatOptions: this.neatOptions,
      populationOptions: this.populationOptions,
      genomeOptions: this.genomeOptions,
      populationFactoryOptions: this.populationFactoryOptions,
      topologyConfigOptions: this.topologyConfigOptions,
    })
  }

  /**
   * Create an organism from serialized organism data.
   * @param {SupportedAlgorithm} algorithmName - The algorithm type (for validation)
   * @param {any} organismData - Serialized organism data from organism.toJSON()
   * @returns {any} Organism instance that can be used with organismToExecutor()
   */
  createOrganism(algorithmName: SupportedAlgorithm, organismData: any): any {
    // Validate algorithm matches
    if (algorithmName !== this.algorithmType) {
      throw new Error(
        `Algorithm mismatch: expected ${this.algorithmType}, got ${algorithmName}`
      )
    }

    // Extract genome data and organism state from the serialized data
    const { genome: genomeData, organismState } = organismData

    // Create genome from factory options
    const genome = this.algorithm.createGenome(
      this.algorithm.createConfig(genomeData.config),
      this.algorithm.createState(genomeData.state),
      genomeData.genomeOptions,
      this.population.initConfig,
      genomeData.factoryOptions // GenomeFactoryOptions
    )

    // Create organism with the genome and organism state
    // Using the Organism class imported from @neat-evolution/evolution
    return new Organism(genome, organismState.generation, {
      fitness: organismState.fitness,
      adjustedFitness: organismState.adjustedFitness,
    })
  }

  /**
   * Convert an organism to an executor.
   * @param {any} organism - The organism to convert
   * @returns {SyncExecutor} A SyncExecutor that can execute the organism's neural network
   */
  organismToExecutor(organism: any): SyncExecutor {
    return createExecutor(this.algorithm.createPhenotype(organism.genome))
  }

  /**
   * Get the best executor from the current population.
   * @returns {SyncExecutor} The best executor from the population
   * @throws {Error} if no best genome found (shouldn't happen after first evaluation)
   */
  getBestExecutor(): SyncExecutor {
    const best = this.population.best()
    if (best == null) {
      throw new Error('No best genome found')
    }
    return this.organismToExecutor(best)
  }

  /**
   * Get the current population data for serialization.
   * @returns {any} PopulationData that can be JSON-serialized and used to restore the population
   */
  getPopulationData(): any {
    return this.population.toJSON()
  }

  /**
   * Initialize population with mutations and evaluation.
   * Call this once after construction before calling evolve().
   */
  async initializePopulation() {
    for (let i = 0; i < this.evolutionOptions.initialMutations; i++) {
      await this.population.mutate()
    }
    await this.population.evaluate()
  }

  /**
   * Evolve the population for a number of iterations.
   * @param {Partial<EvolutionOptions<any, any>>} [options] - Optional evolution options to override defaults
   * @returns {Promise<any>} The best organism after evolution
   */
  async evolve(options?: Partial<EvolutionOptions<any, any>>) {
    const currentEvolutionOptions: EvolutionOptions<any, any> = {
      ...this.evolutionOptions,
      ...options,
      initialMutations: 0, // Never repeat initial mutations
    }

    return await neatEvolve(this.population, currentEvolutionOptions)
  }

  /**
   * Reset population with new configuration.
   * This terminates existing workers and creates a new population.
   * @param {Partial<EvolutionManagerConfig>} [config] - Partial configuration to override current settings
   */
  async resetPopulation(config?: Partial<EvolutionManagerConfig>) {
    // Terminate existing workers
    await this.terminate()

    // Handle algorithm change
    if (config?.algorithm != null && config.algorithm !== this.algorithmType) {
      this.algorithmType = config.algorithm
      const definition = getAlgorithmDefinition(config.algorithm)
      this.algorithm = definition.algorithm as AnyAlgorithm<G>

      // Algorithm change requires module pathnames
      if (config.modulePathnames == null) {
        throw new Error(
          'modulePathnames must be provided when changing algorithm'
        )
      }
      this.modulePathnames = config.modulePathnames
    } else if (config?.modulePathnames != null) {
      // Update module pathnames even without algorithm change
      this.modulePathnames = config.modulePathnames
    }

    // Update configuration
    if (config?.evolutionOptions != null) {
      Object.assign(this.evolutionOptions, config.evolutionOptions)
    }
    if (config?.neatOptions != null) {
      Object.assign(this.neatOptions, config.neatOptions)
    }
    if (config?.populationOptions != null) {
      Object.assign(this.populationOptions, config.populationOptions)
    }
    if (config?.environmentConfig != null) {
      Object.assign(this.environmentConfig, config.environmentConfig)
    }
    if (config?.strategyOptions != null) {
      Object.assign(this.strategyOptions, config.strategyOptions)
    }

    // Update genome options if algorithm changed OR if genome options provided
    if (config?.algorithm != null || config?.genomeOptions != null) {
      this.configureGenomeOptions(
        this.algorithmType,
        config?.genomeOptions ?? {}
      )
    }

    // Reset topology config to defaults (for DES-HyperNEAT)
    this.topologyConfigOptions = {
      ...defaultTopologyConfigOptions,
    }

    // Update factory options (if provided, otherwise clear to create fresh population)
    this.populationFactoryOptions = config?.populationFactoryOptions

    // Recreate population
    this.population = this.createPopulationInternal()

    // Re-initialize
    if (this.populationFactoryOptions == null) {
      // New population: mutate and evaluate
      await this.initializePopulation()
    } else {
      // Restored population: skip mutations but still evaluate
      await this.population.evaluate()
    }
  }

  /**
   * Clean up resources and terminate worker threads.
   */
  async terminate() {
    for (const terminable of this.terminables) {
      await terminable.terminate()
    }
    this.terminables.clear()
  }
}
