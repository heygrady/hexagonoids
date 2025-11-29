import type { SupportedAlgorithm } from '@heygrady/tictactoe-demo'
import type { Activation } from '@neat-evolution/core'
import { get, set, del } from 'idb-keyval'

import type {
  SerializableGenerationSnapshot,
  RuntimeGenerationSnapshot,
} from './GameState.js'

const POPULATION_STORAGE_PREFIX = 'tictactoe-population'
const POPULATION_METADATA_KEY = 'tictactoe-population-metadata'

/**
 * Metadata for a stored population.
 */
export interface PopulationMetadata {
  algorithm: SupportedAlgorithm
  activation: Activation
  timestamp: number
  generation?: number
  size: number // Size in bytes of JSON-stringified population data
}

/**
 * Stored population data with generation snapshots.
 */
export interface StoredPopulationData {
  populationData: any // From population.toJSON()
  committedSnapshot?: SerializableGenerationSnapshot // Current training generation
  bestSnapshot?: SerializableGenerationSnapshot // Historical best ever seen
}

/**
 * Generate storage key for a specific algorithm/activation combo.
 * @param {SupportedAlgorithm} algorithm - The algorithm type
 * @param {Activation} activation - The activation function
 * @returns {string} Storage key like 'tictactoe-population-NEAT-GELU'
 */
export const getPopulationStorageKey = (
  algorithm: SupportedAlgorithm,
  activation: Activation
): string => {
  return `${POPULATION_STORAGE_PREFIX}-${algorithm}-${activation}`
}

/**
 * Load metadata for all stored populations.
 * @returns {Promise<PopulationMetadata[]>} Array of metadata objects
 */
export const loadPopulationMetadata = async (): Promise<
  PopulationMetadata[]
> => {
  try {
    const stored = await get<PopulationMetadata[]>(POPULATION_METADATA_KEY)
    return stored ?? []
  } catch (error) {
    console.warn('Failed to load population metadata from IndexedDB:', error)
    return []
  }
}

/**
 * Save metadata for all stored populations.
 * @param {PopulationMetadata[]} metadata - Array of metadata objects
 */
const savePopulationMetadata = async (
  metadata: PopulationMetadata[]
): Promise<void> => {
  try {
    await set(POPULATION_METADATA_KEY, metadata)
  } catch (error) {
    console.warn('Failed to save population metadata to IndexedDB:', error)
  }
}

/**
 * Save population data to IndexedDB with size logging.
 * @param {any} populationData - Population data from population.toJSON()
 * @param {SupportedAlgorithm} algorithm - The algorithm type
 * @param {Activation} activation - The activation function
 * @param {RuntimeGenerationSnapshot} [committedSnapshot] - Current training generation snapshot
 * @param {RuntimeGenerationSnapshot} [bestSnapshot] - Historical best generation snapshot
 */
export const savePopulationToStorage = async (
  populationData: any,
  algorithm: SupportedAlgorithm,
  activation: Activation,
  committedSnapshot?: RuntimeGenerationSnapshot,
  bestSnapshot?: RuntimeGenerationSnapshot
): Promise<void> => {
  try {
    const key = getPopulationStorageKey(algorithm, activation)

    // Convert runtime snapshots to serializable by removing executor
    const committedSerialized: SerializableGenerationSnapshot | undefined =
      committedSnapshot != null
        ? {
          generation: committedSnapshot.generation,
          fitness: committedSnapshot.fitness,
          bestOrganismData: committedSnapshot.bestOrganismData,
          glickoData: committedSnapshot.glickoData,
        }
        : undefined

    const bestSerialized: SerializableGenerationSnapshot | undefined =
      bestSnapshot != null
        ? {
          generation: bestSnapshot.generation,
          fitness: bestSnapshot.fitness,
          bestOrganismData: bestSnapshot.bestOrganismData,
          glickoData: bestSnapshot.glickoData,
        }
        : undefined

    // Create stored data with population and both snapshots
    const storedData: StoredPopulationData = {
      populationData,
      committedSnapshot: committedSerialized,
      bestSnapshot: bestSerialized,
    }

    const jsonString = JSON.stringify(storedData)
    const sizeBytes = jsonString.length
    const sizeMB = (sizeBytes / (1024 * 1024)).toFixed(2)

    // Log population size
    const genInfo = []
    if (committedSnapshot?.generation != null) {
      genInfo.push(`Committed: gen ${committedSnapshot.generation}`)
    }
    if (bestSnapshot?.generation != null) {
      genInfo.push(`Best: gen ${bestSnapshot.generation}`)
    }
    console.log(
      `[PopulationPersistence] Saving ${algorithm}-${activation}:`,
      `${sizeBytes.toLocaleString()} bytes (${sizeMB}MB)`,
      genInfo.length > 0 ? `| ${genInfo.join(', ')}` : ''
    )

    // Save population data with snapshot
    await set(key, storedData)

    // Update metadata
    const metadata = await loadPopulationMetadata()
    const existingIndex = metadata.findIndex(
      (m) => m.algorithm === algorithm && m.activation === activation
    )

    const newMetadata: PopulationMetadata = {
      algorithm,
      activation,
      timestamp: Date.now(),
      generation: committedSnapshot?.generation ?? bestSnapshot?.generation,
      size: sizeBytes,
    }

    if (existingIndex >= 0) {
      metadata[existingIndex] = newMetadata
    } else {
      metadata.push(newMetadata)
    }

    await savePopulationMetadata(metadata)

    // Log total storage stats
    const totalSize = metadata.reduce((sum, m) => sum + m.size, 0)
    const totalMB = (totalSize / (1024 * 1024)).toFixed(2)
    console.log(
      `[PopulationPersistence] Total: ${metadata.length} combos, ${totalMB}MB used`
    )
  } catch (error) {
    console.warn('Failed to save population to IndexedDB:', error)
  }
}

/**
 * Load population data from IndexedDB for a specific algorithm/activation combo.
 * @param {SupportedAlgorithm} algorithm - The algorithm type
 * @param {Activation} activation - The activation function
 * @returns {Promise<StoredPopulationData | null>} Stored data with population and snapshot, or null if not found
 */
export const loadPopulationFromStorage = async (
  algorithm: SupportedAlgorithm,
  activation: Activation
): Promise<StoredPopulationData | null> => {
  try {
    const key = getPopulationStorageKey(algorithm, activation)
    const stored = await get<any>(key)

    if (stored == null) {
      return null
    }

    // Validate data structure - must have the new StoredPopulationData format
    if (
      typeof stored !== 'object' ||
      stored.populationData?.factoryOptions == null
    ) {
      console.warn(
        `[PopulationPersistence] Discarding malformed data for ${algorithm}-${activation}`,
        'Expected StoredPopulationData format with populationData.factoryOptions'
      )
      // Clear the malformed data
      await del(key)
      return null
    }

    const genInfo = []
    if (stored.committedSnapshot?.generation != null) {
      genInfo.push(`Committed: gen ${stored.committedSnapshot.generation}`)
    }
    if (stored.bestSnapshot?.generation != null) {
      genInfo.push(`Best: gen ${stored.bestSnapshot.generation}`)
    }
    // Handle legacy generationSnapshot field for backwards compatibility
    if (stored.generationSnapshot?.generation != null && genInfo.length === 0) {
      genInfo.push(`Legacy: gen ${stored.generationSnapshot.generation}`)
    }
    console.log(
      `[PopulationPersistence] Restored ${algorithm}-${activation} from storage`,
      genInfo.length > 0 ? `(${genInfo.join(', ')})` : ''
    )

    return stored as StoredPopulationData
  } catch (error) {
    console.warn('Failed to load population from IndexedDB:', error)
    return null
  }
}

/**
 * List all stored population keys with metadata.
 * @returns {Promise<Array<{key: string, metadata: PopulationMetadata}>>} Array of stored populations
 */
export const listStoredPopulations = async (): Promise<
  Array<{ key: string; metadata: PopulationMetadata }>
> => {
  try {
    const metadata = await loadPopulationMetadata()
    return metadata.map((m) => ({
      key: getPopulationStorageKey(m.algorithm, m.activation),
      metadata: m,
    }))
  } catch (error) {
    console.warn('Failed to list stored populations:', error)
    return []
  }
}

/**
 * Prune old populations to maintain a maximum count.
 * Removes oldest populations first (by timestamp).
 * @param {number} [keepCount] - Maximum number of populations to retain (default: 5)
 */
export const pruneOldPopulations = async (
  keepCount: number = 5
): Promise<void> => {
  try {
    const metadata = await loadPopulationMetadata()

    if (metadata.length <= keepCount) {
      return // Nothing to prune
    }

    // Sort by timestamp (oldest first)
    const sorted = [...metadata].sort((a, b) => a.timestamp - b.timestamp)

    // Determine how many to remove
    const toRemove = sorted.slice(0, metadata.length - keepCount)

    // Remove old populations
    for (const m of toRemove) {
      const key = getPopulationStorageKey(m.algorithm, m.activation)
      await del(key)
      console.log(
        `[PopulationPersistence] Pruned ${m.algorithm}-${m.activation}`,
        `(${new Date(m.timestamp).toLocaleString()})`
      )
    }

    // Update metadata to only keep retained populations
    const retained = sorted.slice(metadata.length - keepCount)
    await savePopulationMetadata(retained)

    const totalSize = retained.reduce((sum, m) => sum + m.size, 0)
    const totalMB = (totalSize / (1024 * 1024)).toFixed(2)
    console.log(
      `[PopulationPersistence] After pruning: ${retained.length} combos, ${totalMB}MB used`
    )
  } catch (error) {
    console.warn('Failed to prune old populations:', error)
  }
}

/**
 * Clear a specific population from IndexedDB.
 * @param {SupportedAlgorithm} algorithm - The algorithm type
 * @param {Activation} activation - The activation function
 */
export const clearPopulationFromStorage = async (
  algorithm: SupportedAlgorithm,
  activation: Activation
): Promise<void> => {
  try {
    const key = getPopulationStorageKey(algorithm, activation)
    await del(key)

    // Update metadata
    const metadata = await loadPopulationMetadata()
    const filtered = metadata.filter(
      (m) => !(m.algorithm === algorithm && m.activation === activation)
    )
    await savePopulationMetadata(filtered)

    console.log(`[PopulationPersistence] Cleared ${algorithm}-${activation}`)
  } catch (error) {
    console.warn('Failed to clear population from IndexedDB:', error)
  }
}
