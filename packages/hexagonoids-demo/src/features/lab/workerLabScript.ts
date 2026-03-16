import { Handler } from '@neat-evolution/worker-actions'

import {
  type AnalyzeBatchResult,
  type AnalyzeBatchResultEntry,
  analyzeBatch,
  init,
  terminate,
} from './workerLabActions.js'

interface LabRuntime {
  loadTrainingFitness: typeof import('../registries/hydrateGenome.js').loadTrainingFitness
  hydrateToExecutor: typeof import('../registries/hydrateGenome.js').hydrateToExecutor
  createVanillaAgent: typeof import('@neat-evolution/execution-manager').createVanillaAgent
  createGameAgent: typeof import('@heygrady/hexagonoids-environment').createGameAgent
  simulateGame: typeof import('@heygrady/hexagonoids-environment').simulateGame
  aggregateMetrics: typeof import('@heygrady/hexagonoids-environment').aggregateMetrics
  evaluateFullGameFitness: typeof import('@heygrady/hexagonoids-environment').evaluateFullGameFitness
  computePossibleDeaths: typeof import('@heygrady/hexagonoids-environment').computePossibleDeaths
  weightedFitnessSum: typeof import('@heygrady/hexagonoids-environment').weightedFitnessSum
  computeBehavioralProfile: typeof import('@heygrady/hexagonoids-environment').computeBehavioralProfile
  generationSeedPack: typeof import('../training/evaluation/seedSchedule.js').generationSeedPack
}

let runtime: LabRuntime | null = null

const handler = new Handler()

handler.register(init, async (_payload, _context) => {
  const env = await import('@heygrady/hexagonoids-environment')
  const { createVanillaAgent } = await import(
    '@neat-evolution/execution-manager'
  )
  const { hydrateToExecutor, loadTrainingFitness } = await import(
    '../registries/hydrateGenome.js'
  )
  const { generationSeedPack } = await import(
    '../training/evaluation/seedSchedule.js'
  )

  runtime = {
    loadTrainingFitness,
    hydrateToExecutor,
    createVanillaAgent,
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
      includePerSeedMetrics,
      fitnessWeights,
      gateConfig,
    } = payload

    const simConfig = { maxTicks, dtMs, useFastThrust: true }
    const entries: AnalyzeBatchResultEntry[] = []

    for (const ref of genomeRefs) {
      const executor = runtime.hydrateToExecutor(ref.genomePath, method)
      const trainingFitness = runtime.loadTrainingFitness(ref.genomePath)
      const episodicAgent = runtime.createVanillaAgent(executor, {})
      const gameAgent = runtime.createGameAgent(episodicAgent)

      // Run simulations
      const seeds = runtime.generationSeedPack(
        ref.generation,
        seedsPerGenome,
        `${baseSeed}:analysis`
      )
      const allMetrics: import('@heygrady/hexagonoids-environment').RawMetrics[] =
        []

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
        scoring: { productionFitness, alternativeScores: {} },
        rocksDestroyed: aggregated.rocksDestroyed / n,
        accuracy: aggregated.accuracy,
        deaths: aggregated.deaths / n,
        score: aggregated.score / n,
      }

      const entry: AnalyzeBatchResultEntry = { behavior }
      if (includePerSeedMetrics) {
        entry.perSeedMetrics = allMetrics
      }
      entries.push(entry)
    }

    return { entries }
  }
)

handler.register(terminate, async (_payload, _context) => {
  runtime = null
  return null
})

handler.ready()
