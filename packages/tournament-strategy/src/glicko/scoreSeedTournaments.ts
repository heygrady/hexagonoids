import type { EvaluationContext } from '@neat-evolution/evaluation-strategy'
import type { AnyGenome, GenomeEntry } from '@neat-evolution/evaluator'
import type { Glicko2, Player as GlickoPlayer } from 'glicko2'

import { evaluateIndividually } from '../evaluate/evaluateIndividually.js'

import type { GlickoNormalizationRanges } from './types.js'

export interface SeedTournamentOptions {
  currentGeneration: number
  normalizationRanges: GlickoNormalizationRanges
}

/**
 * Runs multiple seed tournaments to warm up Glicko ratings before head-to-head matches.
 * Each tournament consists of multiple rounds where entries are evaluated individually
 * against built-in AI, then matched based on Glicko ratings.
 * @template G - The genome type
 * @param {EvaluationContext<G>} context - The evaluation context
 * @param {Array<GenomeEntry<G>>} allEntries - All entries including heroes and fillers
 * @param {number} numEvaluations - Number of individual evaluations to run
 * @param {Glicko2} glicko - Glicko2 instance for rating updates
 * @param {Map<number, GlickoPlayer>} playerRatings - Map of current Glicko players
 * @param {SeedTournamentOptions} options - Tournament configuration options
 * @returns {Promise<{ rawScores: Map<number, number>; normalizedScores: Map<number, number>; seedAIPlayer: GlickoPlayer }>} Object with raw and normalized seed scores for each entry
 */
export async function scoreSeedTournaments<G extends AnyGenome<G>>(
  context: EvaluationContext<G>,
  allEntries: Array<GenomeEntry<G>>,
  numEvaluations: number,
  glicko: Glicko2,
  playerRatings: Map<number, GlickoPlayer>,
  options: SeedTournamentOptions
): Promise<{
  rawScores: Map<number, number>
  normalizedScores: Map<number, number>
  seedAIPlayer: GlickoPlayer
}> {
  const { currentGeneration, normalizationRanges } = options

  // Create virtual "SeedAI" player representing the AI gauntlet
  const SEED_AI_ID = -1
  const seedAIPlayer = glicko.makePlayer(1600, 120, 0.06)
  playerRatings.set(SEED_AI_ID, seedAIPlayer)

  // Accumulate scores for averaging
  const scoreAccumulator = new Map<number, number[]>()

  // Normalization constants
  const minScore = normalizationRanges.environmentFitness.min ?? 0
  const maxScore = normalizationRanges.environmentFitness.max ?? 1
  const scoreRange = Math.max(1e-6, maxScore - minScore)

  // Step 1: Run all evaluations in parallel
  const allEvaluationPromises: Array<Promise<Array<[number, number]>>> = []

  for (let i = 0; i < numEvaluations; i++) {
    const roundSeed =
      String(currentGeneration * 10000 + i * 1000) +
      String(Math.random()).slice(2, 6)
    allEvaluationPromises.push(
      evaluateIndividually(context, allEntries, roundSeed)
    )
  }

  const allEvaluationResults = await Promise.all(allEvaluationPromises)
  // Step 2: Process results and update Glicko
  for (const evaluationResult of allEvaluationResults) {
    const glickoMatches: Array<[GlickoPlayer, GlickoPlayer, number]> = []
    for (const [entryId, rawScore] of evaluationResult) {
      // Accumulate for averaging
      if (!scoreAccumulator.has(entryId)) {
        scoreAccumulator.set(entryId, [])
      }
      scoreAccumulator.get(entryId)?.push(rawScore)

      // Get agent's Glicko player
      const agentPlayer = playerRatings.get(entryId)
      if (agentPlayer == null) continue

      // Normalize score to 0-1 (soft normalization, allows outliers)
      const normalizedScore = (rawScore - minScore) / scoreRange

      // Use normalized score directly as Glicko match outcome
      // 0.0 = complete loss to AI, 0.5 = draw, 1.0 = complete win
      glickoMatches.push([agentPlayer, seedAIPlayer, normalizedScore])
    }
    // Update Glicko ratings for this round
    glicko.updateRatings(glickoMatches)
  }

  // Calculate average raw scores
  const rawScores = new Map<number, number>()
  for (const [entryId, scores] of scoreAccumulator.entries()) {
    const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length
    rawScores.set(entryId, avgScore)
  }

  // Calculate normalized scores
  const normalizedScores = new Map<number, number>()
  for (const [entryId, rawScore] of rawScores.entries()) {
    const normalized = (rawScore - minScore) / scoreRange
    normalizedScores.set(entryId, normalized)
  }

  return { rawScores, normalizedScores, seedAIPlayer }
}
