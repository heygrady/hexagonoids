import { Handler } from '@neat-evolution/worker-actions'

import {
  type AnalyzeBatchResult,
  type AnalyzeBatchResultEntry,
  analyzeBatch,
  init,
  terminate,
} from './workerLabActions.js'

interface LabRuntime {
  loadGenome: typeof import('../persistence/loadGenome.js').loadGenome
  isSerializedOrganism: typeof import('../training/serialization/serializedOrganism.js').isSerializedOrganism
  createGenomeFromSerialized: typeof import('../registries/algorithmRegistry.js').createGenomeFromSerialized
  createPhenotypeForGenome: typeof import('../registries/algorithmRegistry.js').createPhenotypeForGenome
  HEXAGONOIDS_IO: typeof import('../registries/algorithmRegistry.js').HEXAGONOIDS_IO
  createExecutor: typeof import('@neat-evolution/executor').createExecutor
  createNeatAgent: typeof import('@heygrady/hexagonoids-environment').createNeatAgent
  simulateGame: typeof import('@heygrady/hexagonoids-environment').simulateGame
  aggregateMetrics: typeof import('@heygrady/hexagonoids-environment').aggregateMetrics
  evaluateFullGameFitness: typeof import('@heygrady/hexagonoids-environment').evaluateFullGameFitness
  computePossibleDeaths: typeof import('@heygrady/hexagonoids-environment').computePossibleDeaths
  weightedFitnessSum: typeof import('@heygrady/hexagonoids-environment').weightedFitnessSum
  generationSeedPack: typeof import('../training/evaluation/seedSchedule.js').generationSeedPack
}

let runtime: LabRuntime | null = null

function shannonEntropy(fractions: number[]): number {
  let h = 0
  for (const p of fractions) {
    if (p > 0) {
      h -= p * Math.log2(p)
    }
  }
  return h
}

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return value != null && typeof value === 'object'
}

const handler = new Handler()

handler.register(init, async (_payload, _context) => {
  const demoNode = await import('@heygrady/hexagonoids-demo/node')
  const env = await import('@heygrady/hexagonoids-environment')
  const { createExecutor } = await import('@neat-evolution/executor')
  const { isSerializedOrganism } = await import(
    '../training/serialization/serializedOrganism.js'
  )
  const {
    createGenomeFromSerialized,
    createPhenotypeForGenome,
    HEXAGONOIDS_IO,
  } = await import('../registries/algorithmRegistry.js')
  const { generationSeedPack } = await import(
    '../training/evaluation/seedSchedule.js'
  )

  runtime = {
    loadGenome: demoNode.loadGenome,
    isSerializedOrganism,
    createGenomeFromSerialized,
    createPhenotypeForGenome,
    HEXAGONOIDS_IO,
    createExecutor,
    createNeatAgent: env.createNeatAgent,
    simulateGame: env.simulateGame,
    aggregateMetrics: env.aggregateMetrics,
    evaluateFullGameFitness: env.evaluateFullGameFitness,
    computePossibleDeaths: env.computePossibleDeaths,
    weightedFitnessSum: env.weightedFitnessSum,
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
    const agent = runtime.createNeatAgent()
    const entries: AnalyzeBatchResultEntry[] = []

    for (const ref of genomeRefs) {
      const serialized = runtime.loadGenome(ref.genomePath)

      if (!runtime.isSerializedOrganism(serialized)) {
        throw new Error(`Invalid genome at ${ref.genomePath}`)
      }

      // Hydrate genome
      const genomeData = serialized.genome
      const genomeOptions = genomeData.genomeOptions
      const initConfig = isRecord(genomeOptions?.initConfig)
        ? genomeOptions.initConfig
        : runtime.HEXAGONOIDS_IO

      const genome = runtime.createGenomeFromSerialized(
        method,
        genomeData,
        initConfig
      )
      const phenotype = runtime.createPhenotypeForGenome(method, genome)
      const executor = runtime.createExecutor(phenotype)

      // Run simulations
      const seeds = runtime.generationSeedPack(
        ref.generation,
        seedsPerGenome,
        `${baseSeed}:analysis`
      )
      const allMetrics: import('@heygrady/hexagonoids-environment').RawMetrics[] =
        []

      for (const seed of seeds) {
        const metrics = runtime.simulateGame(agent, simConfig, seed, executor)
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
      const alive = aggregated.aliveFrames || 1

      // Action profile
      const thrustPct = aggregated.thrustFrames / alive
      const firePct = aggregated.fireFrames / alive
      const leftPct = aggregated.leftFrames / alive
      const rightPct = aggregated.rightFrames / alive
      const total = thrustPct + firePct + leftPct + rightPct
      const fractions =
        total > 0
          ? [
              thrustPct / total,
              firePct / total,
              leftPct / total,
              rightPct / total,
            ]
          : [0.25, 0.25, 0.25, 0.25]
      const entropy = shannonEntropy(fractions)

      // Movement profile
      const idleFrames =
        alive -
        Math.max(
          aggregated.thrustFrames,
          aggregated.leftFrames,
          aggregated.rightFrames
        )
      const idlePct = Math.max(0, idleFrames) / alive

      // Engagement
      const framesWithRocksInSOIPct = aggregated.framesWithRocksInSOI / alive

      // Training fitness from the serialized organism state
      const trainingFitness = serialized.organismState?.fitness ?? 0

      // Average per-seed values
      const avgDistance = aggregated.distanceTraveled / n
      const avgCells = Math.round(aggregated.uniqueCellsVisited / n)
      const avgRocks = aggregated.rocksDestroyed / n
      const avgDeaths = aggregated.deaths / n
      const avgScore = aggregated.score / n

      const behavior = {
        generation: ref.generation,
        trainingFitness,
        action: { thrustPct, firePct, leftPct, rightPct, entropy },
        movement: {
          distanceTraveled: avgDistance,
          uniqueCells: avgCells,
          idlePct,
        },
        engagement: { framesWithRocksInSOIPct },
        scoring: { productionFitness, alternativeScores: {} },
        rocksDestroyed: avgRocks,
        accuracy: aggregated.accuracy,
        deaths: avgDeaths,
        score: avgScore,
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
