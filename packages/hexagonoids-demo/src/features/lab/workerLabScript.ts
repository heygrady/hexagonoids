import type {
  ActionController,
  BehavioralProfile,
  FitnessContext,
  FitnessWeights,
  GameAgent,
  GateConfig,
  RawMetrics,
} from '@heygrady/hexagonoids-environment'
import type { StaticExecutor } from '@neat-evolution/executor'
import { Handler } from '@neat-evolution/worker-actions'

import type { SupportedAlgorithm } from '../registries/algorithmRegistry.js'
import {
  type AnalyzeBatchResult,
  type AnalyzeBatchResultEntry,
  analyzeBatch,
  init,
  terminate,
} from './workerLabActions.js'

interface LabRuntime {
  hydrateToExecutor(
    genomePath: string,
    method: SupportedAlgorithm
  ): StaticExecutor
  loadTrainingFitness(genomePath: string): number
  createVanillaController(
    executor: StaticExecutor,
    options: Record<string, never>
  ): ActionController
  createGameAgent(agent: ActionController): GameAgent
  simulateGame(
    agent: GameAgent['agent'],
    config: { maxTicks: number; dtMs: number; useFastThrust: boolean },
    seed: string
  ): RawMetrics
  aggregateMetrics(metrics: RawMetrics[]): RawMetrics
  evaluateFullGameFitness(metrics: RawMetrics, dtMs?: number): number
  computePossibleDeaths(elapsedTicks: number, dtMs: number): number
  weightedFitnessSum(
    metrics: RawMetrics,
    weights: FitnessWeights,
    gateConfig: GateConfig,
    context: FitnessContext
  ): number
  computeBehavioralProfile(
    aggregated: RawMetrics,
    seedCount: number
  ): BehavioralProfile
  generationSeedPack(
    generation: number,
    seedsPerGenome: number,
    baseSeed: string
  ): string[]
}

let runtime: LabRuntime | null = null

const handler = new Handler()

handler.register(init, async (_payload, _context) => {
  const env = await import('@heygrady/hexagonoids-environment')
  const { createVanillaStepAgent } = await import('@neat-evolution/rl-core')
  const { hydrateToExecutor, loadTrainingFitness } = await import(
    '../registries/hydrateGenome.js'
  )
  const { generationSeedPack } = await import(
    '../training/evaluation/seedSchedule.js'
  )

  runtime = {
    loadTrainingFitness,
    hydrateToExecutor,
    createVanillaController: (executor) => createVanillaStepAgent(executor),
    createGameAgent: env.createGameAgent,
    simulateGame: env.simulateGame,
    aggregateMetrics: env.aggregateMetrics,
    evaluateFullGameFitness: env.evaluateFullGameFitness,
    computePossibleDeaths: env.computePossibleDeaths,
    weightedFitnessSum: env.weightedFitnessSum,
    computeBehavioralProfile: env.computeBehavioralProfile,
    generationSeedPack,
  }

  return null
})

handler.register(
  analyzeBatch,
  async (payload, _context): Promise<AnalyzeBatchResult> => {
    if (runtime == null) throw new Error('Worker not initialized')

    const {
      genomeRefs,
      method,
      seedsPerGenome,
      maxTicks,
      dtMs,
      baseSeed,
      fitnessWeights,
      gateConfig,
    } = payload

    const simConfig = { maxTicks, dtMs, useFastThrust: true }
    const entries: AnalyzeBatchResultEntry[] = []

    for (const ref of genomeRefs) {
      const executor = runtime.hydrateToExecutor(ref.genomePath, method)
      const trainingFitness = runtime.loadTrainingFitness(ref.genomePath)
      const controller = runtime.createVanillaController(executor, {})
      const gameAgent = runtime.createGameAgent(controller)

      // Run simulations
      const seeds = runtime.generationSeedPack(
        ref.generation,
        seedsPerGenome,
        `${baseSeed}:analysis`
      )
      const allMetrics: RawMetrics[] = []

      for (const seed of seeds) {
        const metrics = runtime.simulateGame(gameAgent.agent, simConfig, seed)
        allMetrics.push(metrics)
      }

      // Compute per-seed fitness
      const perSeedFitness: number[] = []
      for (const m of allMetrics) {
        const possibleDeaths = runtime.computePossibleDeaths(
          m.elapsedTicks,
          dtMs
        )
        if (fitnessWeights != null && gateConfig != null) {
          perSeedFitness.push(
            runtime.weightedFitnessSum(m, fitnessWeights, gateConfig, {
              possibleDeaths,
              dtMs,
            })
          )
        } else {
          perSeedFitness.push(runtime.evaluateFullGameFitness(m, dtMs))
        }
      }

      const n = allMetrics.length
      const productionFitness =
        n > 0 ? perSeedFitness.reduce((a, b) => a + b, 0) / n : 0

      // Aggregated metrics for behavioral profile
      const aggregated = runtime.aggregateMetrics(allMetrics)
      const profile = runtime.computeBehavioralProfile(aggregated, n)

      const behavior = {
        generation: ref.generation,
        trainingFitness,
        action: profile.action,
        movement: profile.movement,
        engagement: profile.engagement,
        scoring: { productionFitness },
        rocksDestroyed: aggregated.rocksDestroyed / n,
        accuracy: aggregated.accuracy,
        deaths: aggregated.deaths / n,
        score: aggregated.score / n,
      }

      entries.push({ behavior })
    }

    return { entries }
  }
)

handler.register(terminate, async (_payload, _context) => {
  runtime = null
  return null
})

handler.ready()
