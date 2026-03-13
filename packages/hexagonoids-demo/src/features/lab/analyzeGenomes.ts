import {
  aggregateMetrics,
  computePossibleDeaths,
  createNeatAgent,
  evaluateFullGameFitness,
  type FitnessWeights,
  type GateConfig,
  type RawMetrics,
  simulateGame,
  weightedFitnessSum,
} from '@heygrady/hexagonoids-environment'
import type { AnyErasedGenome } from '@neat-evolution/evaluator'
import { createExecutor } from '@neat-evolution/executor'
import {
  createGenomeFromSerialized,
  createPhenotypeForGenome,
  HEXAGONOIDS_IO,
  type SerializedGenome,
  type SupportedAlgorithm,
} from '../../algorithmRegistry.js'
import { generationSeedPack } from '../../evaluation/seedSchedule.js'
import { loadGenome } from '../../persistence/loadGenome.js'
import {
  isSerializedOrganism,
  type SerializedOrganism,
} from '../../serialization/serializedOrganism.js'
import type { GenomeBehavior, ScoringMethod } from './types.js'

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return value != null && typeof value === 'object'
}

function shannonEntropy(fractions: number[]): number {
  let h = 0
  for (const p of fractions) {
    if (p > 0) {
      h -= p * Math.log2(p)
    }
  }
  return h
}

function hydrateGenome(
  method: SupportedAlgorithm,
  serialized: SerializedOrganism
): AnyErasedGenome {
  const genomeData = serialized.genome
  const genomeOptions = genomeData.genomeOptions
  const initConfig = isRecord(genomeOptions?.initConfig)
    ? genomeOptions.initConfig
    : HEXAGONOIDS_IO

  return createGenomeFromSerialized(
    method,
    genomeData as SerializedGenome,
    initConfig
  )
}

function createExecutorForGenome(
  method: SupportedAlgorithm,
  genome: AnyErasedGenome
) {
  const phenotype = createPhenotypeForGenome(method, genome)
  return createExecutor(phenotype)
}

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
  const agent = createNeatAgent()

  for (const [i, genomePath] of genomePaths.entries()) {
    const serialized = loadGenome(genomePath)

    if (!isSerializedOrganism(serialized)) {
      throw new Error(`Invalid genome at ${genomePath}`)
    }

    const genome = hydrateGenome(method, serialized)
    const executor = createExecutorForGenome(method, genome)

    const seeds = generationSeedPack(i, seedsPerGenome, `${baseSeed}:analysis`)
    const allMetrics: RawMetrics[] = []

    for (const seed of seeds) {
      const metrics = simulateGame(agent, simConfig, seed, executor)
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
    const alive = aggregated.aliveFrames || 1

    // Action profile (fractions are scale-invariant, so aggregated is fine)
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

    // Engagement (fraction is scale-invariant)
    const framesWithRocksInSOIPct = aggregated.framesWithRocksInSOI / alive

    // Training fitness from the serialized organism state
    const trainingFitness = serialized.organismState?.fitness ?? 0

    // Average per-seed values for the report
    const avgDistance = aggregated.distanceTraveled / n
    const avgCells = Math.round(aggregated.uniqueCellsVisited / n)
    const avgRocks = aggregated.rocksDestroyed / n
    const avgDeaths = aggregated.deaths / n
    const avgScore = aggregated.score / n

    behaviors.push({
      generation: i,
      trainingFitness,
      action: { thrustPct, firePct, leftPct, rightPct, entropy },
      movement: {
        distanceTraveled: avgDistance,
        uniqueCells: avgCells,
        idlePct,
      },
      engagement: { framesWithRocksInSOIPct },
      scoring: { productionFitness, alternativeScores },
      rocksDestroyed: avgRocks,
      accuracy: aggregated.accuracy,
      deaths: avgDeaths,
      score: avgScore,
    })

    onProgress?.(i + 1, genomePaths.length)
  }

  return behaviors
}
