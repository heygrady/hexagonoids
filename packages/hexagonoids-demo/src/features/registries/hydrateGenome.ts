import type { StaticExecutor } from '@neat-evolution/executor'
import { createExecutor } from '@neat-evolution/executor'
import { loadGenome } from '../persistence/loadGenome.js'
import { isSerializedOrganism } from '../training/serialization/serializedOrganism.js'
import {
  createGenomeFromSerialized,
  createPhenotypeForGenome,
  HEXAGONOIDS_IO,
  type SerializedGenome,
  type SupportedAlgorithm,
} from './algorithmRegistry.js'

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value != null && typeof value === 'object'

/**
 * Load a serialized genome from disk and produce a StaticExecutor.
 *
 * Encapsulates: loadGenome → validate → createGenomeFromSerialized
 *   → createPhenotypeForGenome → createExecutor
 */
export function hydrateToExecutor(
  genomePath: string,
  method: SupportedAlgorithm
): StaticExecutor {
  const serialized = loadGenome(genomePath)
  if (!isSerializedOrganism(serialized)) {
    throw new Error(`Invalid genome at ${genomePath}`)
  }
  const genomeData = serialized.genome
  const genomeOptions = genomeData.genomeOptions
  const initConfig = isRecord(genomeOptions?.initConfig)
    ? genomeOptions.initConfig
    : HEXAGONOIDS_IO

  const genome = createGenomeFromSerialized(
    method,
    genomeData as SerializedGenome,
    initConfig
  )
  const phenotype = createPhenotypeForGenome(method, genome)
  return createExecutor(phenotype)
}

/**
 * Extract training fitness from a serialized genome file.
 */
export function loadTrainingFitness(genomePath: string): number {
  const serialized = loadGenome(genomePath)
  if (!isSerializedOrganism(serialized)) return 0
  return serialized.organismState?.fitness ?? 0
}
