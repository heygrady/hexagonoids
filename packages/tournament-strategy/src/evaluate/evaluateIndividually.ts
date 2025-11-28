import type { EvaluationContext } from '@neat-evolution/evaluation-strategy'
import type {
  AnyGenome,
  GenomeEntry,
  FitnessData,
} from '@neat-evolution/evaluator'

import { toId } from '../entities/toId.js'

/**
 * Evaluates all genomes individually in parallel.
 * @template G - The genome type
 * @param {EvaluationContext<G>} context - The evaluation context.
 * @param {Array<GenomeEntry<G>>} entries - The genome entries to evaluate.
 * @param {string} [seed] - Optional seed for the evaluation.
 * @returns {Promise<Array<[number, number]>>} A promise that resolves to an array of [entryId, fitness] tuples.
 */
export async function evaluateIndividually<G extends AnyGenome<G>>(
  context: EvaluationContext<G>,
  entries: Array<GenomeEntry<G>>,
  seed?: string | undefined
): Promise<Array<[number, number]>> {
  const promises: Array<Promise<FitnessData>> = []
  for (const entry of entries) {
    promises.push(context.evaluateGenomeEntry(entry, seed))
  }

  const results = await Promise.all(promises)

  const playerScores: Array<[number, number]> = []
  for (const fitnessData of results) {
    const entryId = toId(fitnessData)
    const fitness = fitnessData[2]
    playerScores.push([entryId, fitness])
  }

  return playerScores
}
