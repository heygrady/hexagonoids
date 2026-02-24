import { Organism } from '@neat-evolution/evolution'
import { createExecutor, type SyncExecutor } from '@neat-evolution/executor'

import {
  createGenomeFromSerialized,
  createPhenotypeForGenome,
  HEXAGONOIDS_IO,
  type SerializedGenome,
  type SupportedAlgorithm,
} from './algorithmRegistry.js'
import type { TrainingRunResult, TrainOptions, TrainResult } from './train.js'

export interface HexagonoidsEvolutionManagerOptions
  extends Omit<TrainOptions, 'baselineOnly'> {
  method?: SupportedAlgorithm | undefined
  trainer?: (options: TrainOptions) => Promise<TrainResult>
  deserializeOrganism?: (pathname: string) => unknown
}

interface SerializedOrganism {
  genome: SerializedGenome
  organismState?: {
    generation?: number | undefined
    fitness?: number | undefined
    adjustedFitness?: number | undefined
  }
}

interface OrganismLike {
  genome: unknown
}

type Trainer = (options: TrainOptions) => Promise<TrainResult>

const DEFAULT_METHOD: SupportedAlgorithm = 'NEAT'

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return value != null && typeof value === 'object'
}

const asSerializedOrganism = (value: unknown): SerializedOrganism | null => {
  if (!isRecord(value)) {
    return null
  }
  if (!isRecord(value.genome)) {
    return null
  }
  if (!isRecord(value.genome.config) || !isRecord(value.genome.state)) {
    return null
  }
  return value as unknown as SerializedOrganism
}

export class HexagonoidsEvolutionManager {
  private readonly trainOptions: Omit<TrainOptions, 'baselineOnly'>
  private bestOrganism: unknown
  private lastResult: TrainingRunResult | undefined
  private readonly method: SupportedAlgorithm
  private readonly trainer: Trainer | undefined
  private readonly deserializeOrganism:
    | ((pathname: string) => unknown)
    | undefined

  constructor(options: HexagonoidsEvolutionManagerOptions = {}) {
    const { trainer, deserializeOrganism, method, ...trainOptions } = options
    this.trainOptions = { ...trainOptions }
    this.method = method ?? DEFAULT_METHOD
    this.trainer = trainer
    this.deserializeOrganism = deserializeOrganism
  }

  initializePopulation(): void {
    this.resetPopulation()
  }

  async evolve(): Promise<unknown> {
    if (!this.trainer) {
      throw new Error('No trainer configured for evolution.')
    }

    const result = await this.trainer({
      ...this.trainOptions,
      method: this.method,
      baselineOnly: false,
    })

    if (result.mode !== 'training') {
      throw new Error('Expected training mode result while evolving.')
    }

    let organism = result.bestOrganism
    if (organism == null && this.deserializeOrganism && result.bestFilePath) {
      const serialized = this.deserializeOrganism(result.bestFilePath)
      organism = this.createOrganism(result.method, serialized)
    }

    if (organism == null) {
      throw new Error('No best organism available after evolution.')
    }

    this.bestOrganism = organism
    this.lastResult = result
    return this.bestOrganism
  }

  resetPopulation(): void {
    this.bestOrganism = undefined
    this.lastResult = undefined
  }

  async terminate(): Promise<void> {
    this.resetPopulation()
  }

  getBestOrganism(): unknown {
    return this.bestOrganism
  }

  getLastResult(): TrainingRunResult | undefined {
    return this.lastResult
  }

  createOrganism(
    algorithmName: SupportedAlgorithm,
    organismData: unknown
  ): unknown {
    if (algorithmName !== this.method) {
      throw new Error(
        `Algorithm mismatch: expected ${this.method}, got ${algorithmName}`
      )
    }

    const parsed = asSerializedOrganism(organismData)
    if (parsed == null) {
      throw new Error('Invalid serialized organism payload.')
    }

    const genomeData = parsed.genome
    const genomeOptions = genomeData.genomeOptions
    const initConfig = isRecord(genomeOptions?.initConfig)
      ? genomeOptions.initConfig
      : HEXAGONOIDS_IO

    const genome = createGenomeFromSerialized(
      this.method,
      genomeData,
      initConfig
    )
    const generation =
      parsed.organismState != null &&
      typeof parsed.organismState.generation === 'number'
        ? parsed.organismState.generation
        : 0
    const fitness =
      parsed.organismState != null &&
      typeof parsed.organismState.fitness === 'number'
        ? parsed.organismState.fitness
        : null
    const adjustedFitness =
      parsed.organismState != null &&
      typeof parsed.organismState.adjustedFitness === 'number'
        ? parsed.organismState.adjustedFitness
        : null

    return new Organism(genome as never, generation, {
      fitness,
      adjustedFitness,
    })
  }

  organismToExecutor(organism: unknown): SyncExecutor {
    const hydratedOrganism = asSerializedOrganism(organism)
    const candidate = hydratedOrganism
      ? this.createOrganism(this.method, hydratedOrganism)
      : organism

    if (!isRecord(candidate) || !('genome' in candidate)) {
      throw new Error('Expected organism instance with a "genome" property.')
    }

    const { genome } = candidate as unknown as OrganismLike
    return createExecutor(
      createPhenotypeForGenome(this.method, genome) as never
    )
  }
}
