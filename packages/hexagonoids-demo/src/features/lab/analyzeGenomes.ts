import {
  aggregateMetrics,
  computeBehavioralProfile,
  computePossibleDeaths,
  createGameAgent,
  evaluateFullGameFitness,
  type FitnessWeights,
  type GateConfig,
  type RawMetrics,
  simulateGame,
  weightedFitnessSum,
} from '@heygrady/hexagonoids-environment'
import { createVanillaStepAgent } from '@neat-evolution/rl-core'
import type { SupportedAlgorithm } from '../registries/algorithmRegistry.js'
import {
  hydrateToExecutor,
  loadTrainingFitness,
} from '../registries/hydrateGenome.js'
import { generationSeedPack } from '../training/evaluation/seedSchedule.js'
import type { GenomeBehavior, ScoringMethod } from './types.js'

export interface AnalyzeGenomesOptions {
  genomePaths: string[]
  method: SupportedAlgorithm
  seedsPerGenome: number
  maxTicks: number
  dtMs: number
  baseSeed: string
  scoringMethods?: Record<string, ScoringMethod> | undefined
  fitnessWeights?: FitnessWeights | undefined
  gateConfig?: GateConfig | undefined
  onProgress?: (completed: number, total: number) => void
}

export async function analyzeGenomes(
  options: AnalyzeGenomesOptions
): Promise<GenomeBehavior[]> {
  const {
    genomePaths,
    method,
    seedsPerGenome,
    maxTicks,
    dtMs,
    baseSeed,
    scoringMethods,
    fitnessWeights,
    gateConfig,
    onProgress,
  } = options

  const simConfig = { maxTicks, dtMs, useFastThrust: true }
  const behaviors: GenomeBehavior[] = []

  for (const [i, genomePath] of genomePaths.entries()) {
    const executor = hydrateToExecutor(genomePath, method)
    const trainingFitness = loadTrainingFitness(genomePath)
    const controller = createVanillaStepAgent(executor)
    const gameAgent = createGameAgent(controller)

    const seeds = generationSeedPack(i, seedsPerGenome, `${baseSeed}:analysis`)
    const allMetrics: RawMetrics[] = []

    for (const seed of seeds) {
      const metrics = simulateGame(gameAgent.agent, simConfig, seed)
      allMetrics.push(metrics)
    }

    // Compute fitness per seed (avoids aggregation bug where summed deaths
    // exceed possibleDeaths and collapse survivalTerm to 0)
    const perSeedFitness: number[] = []
    const perSeedAltScores: Record<string, number[]> = {}
    for (const m of allMetrics) {
      const possibleDeaths = computePossibleDeaths(m.elapsedTicks, dtMs)
      if (fitnessWeights != null && gateConfig != null) {
        perSeedFitness.push(
          weightedFitnessSum(m, fitnessWeights, gateConfig, {
            possibleDeaths,
            dtMs,
          })
        )
      } else {
        perSeedFitness.push(evaluateFullGameFitness(m, dtMs))
      }
      if (scoringMethods != null) {
        for (const [name, fn] of Object.entries(scoringMethods)) {
          let arr = perSeedAltScores[name]
          if (arr == null) {
            arr = []
            perSeedAltScores[name] = arr
          }
          arr.push(fn(m, { generation: i }))
        }
      }
    }

    const n = allMetrics.length
    const productionFitness =
      n > 0 ? perSeedFitness.reduce((a, b) => a + b, 0) / n : 0
    const alternativeScores: Record<string, number> = {}
    for (const [name, arr] of Object.entries(perSeedAltScores)) {
      alternativeScores[name] = arr.reduce((a, b) => a + b, 0) / n
    }

    // Aggregated metrics for behavioral profile (sums → averages for report)
    const aggregated = aggregateMetrics(allMetrics)
    const profile = computeBehavioralProfile(aggregated, n)

    behaviors.push({
      generation: i,
      trainingFitness,
      action: profile.action,
      movement: profile.movement,
      engagement: profile.engagement,
      scoring: { productionFitness, alternativeScores },
      rocksDestroyed: aggregated.rocksDestroyed / n,
      accuracy: aggregated.accuracy,
      deaths: aggregated.deaths / n,
      score: aggregated.score / n,
    })

    onProgress?.(i + 1, genomePaths.length)
  }

  return behaviors
}
