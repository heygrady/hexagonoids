import type { FitnessData, GenomeEntry } from '@neat-evolution/evaluator'

/**
 * Generate a unique numeric ID from genome coordinates.
 * Combines speciesIndex and organismIndex into a single number.
 * Supports up to 67,108,863 species and 67,108,863 organisms per species.
 * Uses 26-bit allocation for each index to support hero ID mangling with 100,000 offset.
 * @param {GenomeEntry<any> | FitnessData} entry - GenomeEntry or FitnessData tuple
 * @returns {number} Unique numeric identifier
 */
export const toId = (entry: GenomeEntry<any> | FitnessData): number => {
  const speciesIndex = entry[0]
  const organismIndex = entry[1]

  // 26 bits each: 0 to 67,108,863 (2^26 - 1)
  if (speciesIndex < 0 || speciesIndex >= 67_108_864) {
    throw new Error(`Species index ${speciesIndex} out of range [0, 67108863]`)
  }
  if (organismIndex < 0 || organismIndex >= 67_108_864) {
    throw new Error(
      `Organism index ${organismIndex} out of range [0, 67108863]`
    )
  }

  // Use 26-bit shift (instead of 16) for larger range
  return (speciesIndex << 26) | organismIndex
}
