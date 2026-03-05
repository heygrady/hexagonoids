import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  doNothingAgent,
  type FitnessWeights,
  type GateConfig,
  type RawMetrics,
  randomAgent,
} from '@heygrady/hexagonoids-environment'
import { createEnvironment } from '@heygrady/hexagonoids-environment/node'
import { defaultEvolutionOptions, evolve } from '@neat-evolution/evolution'
import { WorkerEvaluator } from '@neat-evolution/worker-evaluator'
import type { Terminable } from '@neat-evolution/worker-reproducer'
import { hardwareConcurrency } from '@neat-evolution/worker-threads'

import type { SupportedAlgorithm } from './algorithmRegistry.js'
import {
  createPopulationForTraining,
  getAlgorithmDefinition,
} from './algorithmRegistry.js'
import { buildEnvironmentOptions } from './buildEnvironmentOptions.js'
import { summarizeBaselineAgent } from './evaluation/baselines.js'
import {} from './evaluation/evaluateOrganism.js'
import { mean, median } from './evaluation/metrics.js'
import { generationSeedPack } from './evaluation/seedSchedule.js'
import {
  appendGenerationLog,
  type GenerationLogEntry,
  resolveGenerationsLogPath,
  saveGenerationGenome,
} from './persistence/appendGenerationLog.js'
import { saveGenome } from './persistence/saveGenome.js'
import {
  createWorkerReproducerFactoryForMethod,
  MultiSeedGenerationStrategy,
} from './workerTraining.js'

const DEFAULT_OUTPUT_DIR = fileURLToPath(new URL('../../', import.meta.url))
const DEFAULT_METHOD: SupportedAlgorithm = 'NEAT'
const DEFAULT_BASE_SEED = 'hexagonoids-phase03'
const CREATE_ENVIRONMENT_PATHNAME = '@heygrady/hexagonoids-environment/node'
const CREATE_EXECUTOR_PATHNAME = '@neat-evolution/executor'

const toRunConfig = (options: TrainOptions) => {
  return {
    method: options.method ?? DEFAULT_METHOD,
    populationSize: options.populationSize ?? 100,
    iterations: options.iterations ?? 50,
    secondsLimit: options.secondsLimit ?? 900,
    earlyStopPatience: options.earlyStopPatience ?? 18,
    evaluationSeedsPerOrganism: options.evaluationSeedsPerOrganism ?? 1,
    maxTicks: options.maxTicks ?? 1024,
    dtMs: options.dtMs ?? 33,
    useFastThrust: options.useFastThrust ?? true,
    baseSeed: options.baseSeed ?? DEFAULT_BASE_SEED,
    outputDir: options.outputDir,
    baselineOnly: options.baselineOnly ?? false,
    logInterval: options.logInterval ?? defaultEvolutionOptions.logInterval,
    threadCount:
      options.threadCount ?? Math.max(1, Math.floor(hardwareConcurrency - 1)),
    signal: options.signal,
    scenarioMode: options.scenarioMode ?? false,
    scenariosPerOrganism: options.scenariosPerOrganism ?? 64,
    scenarioMaxTicks: options.scenarioMaxTicks ?? 32,
  }
}

export interface TrainOptions {
  profilePath?: string | undefined
  method?: SupportedAlgorithm | undefined
  baselineOnly?: boolean | undefined
  populationSize?: number | undefined
  iterations?: number | undefined
  secondsLimit?: number | undefined
  earlyStopPatience?: number | undefined
  evaluationSeedsPerOrganism?: number | undefined
  baseSeed?: string | undefined
  maxTicks?: number | undefined
  dtMs?: number | undefined
  useFastThrust?: boolean | undefined
  outputDir?: string | undefined
  logInterval?: number | undefined
  threadCount?: number | undefined
  workerCpuProfiles?: boolean | undefined
  workerCpuProfileDir?: string | undefined
  signal?: AbortSignal | undefined
  scenarioMode?: boolean | undefined
  scenariosPerOrganism?: number | undefined
  scenarioMaxTicks?: number | undefined
  curriculumEnabled?: boolean | undefined
  curriculumCount?: number | undefined
  curriculumWeight?: number | undefined
  fitnessWeights?: FitnessWeights | undefined
  gateConfig?: Partial<GateConfig> | undefined
  scenarioWeight?: number | undefined
  fullGameWeight?: number | undefined
  scenarioSeedsPerOrganism?: number | undefined
  fullGameSeedsPerOrganism?: number | undefined
}

export interface BaselineRunResult {
  mode: 'baseline'
  method: SupportedAlgorithm
  seeds: string[]
  scores: Array<{
    name: string
    meanFitness: number
    metrics: RawMetrics
  }>
}

export interface TrainingRunResult {
  mode: 'training'
  method: SupportedAlgorithm
  bestFitness: number
  populationFitnessMean: number | null
  populationFitnessMedian: number | null
  bestOrganism: unknown
  bestFilePath: string
  generationsLogPath: string
  genomesDir: string
}

export type TrainResult = BaselineRunResult | TrainingRunResult

interface ActiveWorkerCpuProfile {
  kind: string
  threadId: number
  stop: () => Promise<unknown>
}

interface CpuProfileHandleLike {
  stop: () => Promise<unknown>
}

interface ProfilableNodeWorkerLike {
  threadId: number
  startCpuProfile: () => Promise<CpuProfileHandleLike>
}

function isObjectLike(value: unknown): value is Record<PropertyKey, unknown> {
  return value != null && typeof value === 'object'
}

async function waitForWorkerOwnerReady(owner: unknown): Promise<void> {
  if (!isObjectLike(owner) || !('initPromise' in owner)) return
  const initPromise = owner.initPromise
  if (
    initPromise != null &&
    typeof (initPromise as Promise<void>).then === 'function'
  ) {
    await (initPromise as Promise<void>)
  }
}

function getOwnedNodeWorkers(owner: unknown): ProfilableNodeWorkerLike[] {
  if (!isObjectLike(owner) || !('pool' in owner)) return []
  const pool = owner.pool
  if (!isObjectLike(pool) || typeof pool.getWorkers !== 'function') return []
  const workers = pool.getWorkers()
  if (!Array.isArray(workers)) return []

  return workers
    .map((worker) =>
      isObjectLike(worker) && 'nodeWorker' in worker
        ? (worker.nodeWorker as unknown)
        : null
    )
    .filter(
      (worker): worker is ProfilableNodeWorkerLike =>
        isObjectLike(worker) && typeof worker.startCpuProfile === 'function'
    )
}

async function startWorkerCpuProfilesForOwner(
  owner: unknown,
  kind: string
): Promise<ActiveWorkerCpuProfile[]> {
  await waitForWorkerOwnerReady(owner)
  const workers = getOwnedNodeWorkers(owner)
  return await Promise.all(
    workers.map(async (worker) => {
      const handle = await worker.startCpuProfile()
      return {
        kind,
        threadId: worker.threadId,
        stop: () => handle.stop(),
      }
    })
  )
}

async function writeWorkerCpuProfiles(
  profiles: ActiveWorkerCpuProfile[],
  outputDir: string
): Promise<void> {
  if (profiles.length === 0) return
  mkdirSync(outputDir, { recursive: true })

  const writes = profiles.map(async (profile) => {
    const cpuProfile = await profile.stop()
    const pathname = join(
      outputDir,
      `${profile.kind}-worker-${profile.threadId}.cpuprofile`
    )
    writeFileSync(
      pathname,
      typeof cpuProfile === 'string' ? cpuProfile : JSON.stringify(cpuProfile)
    )
  })
  await Promise.all(writes)
}

export async function train(options: TrainOptions = {}): Promise<TrainResult> {
  const config = toRunConfig(options)
  const method = config.method

  if (config.baselineOnly) {
    const seedPack = generationSeedPack(
      0,
      config.evaluationSeedsPerOrganism,
      config.baseSeed
    )
    const simulation = {
      maxTicks: config.maxTicks,
      dtMs: config.dtMs,
      useFastThrust: config.useFastThrust,
    }

    const scores = [
      summarizeBaselineAgent(
        'doNothingAgent',
        doNothingAgent,
        seedPack,
        simulation
      ),
      summarizeBaselineAgent('randomAgent', randomAgent, seedPack, simulation),
    ]

    const result: BaselineRunResult = {
      mode: 'baseline',
      method,
      seeds: seedPack,
      scores,
    }

    return result
  }

  const terminables = new Set<Terminable>()
  const pendingGenerationWrites: Array<
    Promise<{ ok: true } | { ok: false; error: unknown }>
  > = []
  const runStart = Date.now()
  let bestOrganism: unknown
  let bestFitness = Number.NEGATIVE_INFINITY
  let populationFitnessMean: number | null = null
  let populationFitnessMedian: number | null = null
  let workerProfiles: ActiveWorkerCpuProfile[] = []

  let scenarioBank:
    | import('@heygrady/hexagonoids-environment').ScenarioSnapshot[]
    | undefined
  if (config.scenarioMode) {
    const { loadScenarioBank } = await import('./data/scenarios.js')
    scenarioBank = await loadScenarioBank()
    if (scenarioBank.length === 0) {
      throw new Error(
        'Scenario mode enabled but no scenarios found. Run: yarn workspace @heygrady/hexagonoids-demo demo scenarios'
      )
    }
    console.log(
      `Scenario mode: ${scenarioBank.length} scenarios loaded, ${config.scenariosPerOrganism} per organism, ${config.scenarioMaxTicks} max ticks each`
    )
  }

  const environment = createEnvironment(
    buildEnvironmentOptions({ ...options, ...config }, scenarioBank)
  )
  const algorithm = getAlgorithmDefinition(method).createAlgorithm()
  const evaluator = new WorkerEvaluator(algorithm, environment, {
    createEnvironmentPathname: CREATE_ENVIRONMENT_PATHNAME,
    createExecutorPathname: CREATE_EXECUTOR_PATHNAME,
    taskCount: config.populationSize,
    threadCount: config.threadCount,
    strategy: new MultiSeedGenerationStrategy(
      config.evaluationSeedsPerOrganism,
      config.baseSeed,
      mean
    ),
  })
  terminables.add(evaluator)

  const createReproducer = createWorkerReproducerFactoryForMethod(
    method,
    {
      threadCount: config.threadCount,
    },
    terminables
  )

  const population = createPopulationForTraining(method, {
    createReproducer,
    evaluator,
    populationSize: config.populationSize,
  })

  if (options.workerCpuProfiles) {
    const reproducer = isObjectLike(population) ? population.reproducer : null
    const profiledWorkers = await Promise.all([
      startWorkerCpuProfilesForOwner(evaluator, 'evaluator'),
      startWorkerCpuProfilesForOwner(reproducer, 'reproducer'),
    ])
    workerProfiles = profiledWorkers.flat()
  }

  const evolutionOptions = {
    ...defaultEvolutionOptions,
    iterations: config.iterations,
    secondsLimit: config.secondsLimit,
    earlyStop: true,
    earlyStopPatience: config.earlyStopPatience,
    logInterval: config.logInterval,
    ...(config.signal != null && {
      signal: config.signal,
    }),
    handleNewBest: (organism: unknown) => {
      bestOrganism = organism
      if (
        organism != null &&
        typeof organism === 'object' &&
        'fitness' in organism &&
        typeof organism.fitness === 'number'
      ) {
        bestFitness = organism.fitness
      }
    },
    afterEvaluate: (_currentPopulation: unknown, iteration: number) => {
      const best = population.best()
      if (best == null) {
        return
      }

      const entry: GenerationLogEntry = {
        generation: iteration,
        method,
        bestFitness: best.fitness ?? 0,
        seeds: generationSeedPack(
          iteration,
          config.evaluationSeedsPerOrganism,
          config.baseSeed
        ),
        seedsPerOrganism: config.evaluationSeedsPerOrganism,
        baseSeed: config.baseSeed,
        elapsedMs: Date.now() - runStart,
        timestamp: new Date().toISOString(),
      }

      const logWrite = appendGenerationLog(entry, config.outputDir)
        .then(() => ({ ok: true }) as const)
        .catch((error) => ({ ok: false, error }) as const)
      pendingGenerationWrites.push(logWrite)

      const genomeWrite = saveGenerationGenome(
        best,
        iteration,
        config.outputDir
      )
        .then(() => ({ ok: true }) as const)
        .catch((error) => ({ ok: false, error }) as const)
      pendingGenerationWrites.push(genomeWrite)
    },
  }

  try {
    await evolve(population, evolutionOptions)
    const best = bestOrganism ?? population.best()
    if (best == null) {
      throw new Error('No best organism available after evolution run')
    }
    bestOrganism = best

    const heroWriteResults = await Promise.all(pendingGenerationWrites)
    const firstFailedWrite = heroWriteResults.find((result) => !result.ok)
    if (firstFailedWrite != null && !firstFailedWrite.ok) {
      const reason =
        firstFailedWrite.error instanceof Error
          ? firstFailedWrite.error.message
          : String(firstFailedWrite.error)
      throw new Error(`Failed to write generation data: ${reason}`)
    }

    if (
      bestFitness === Number.NEGATIVE_INFINITY &&
      typeof best === 'object' &&
      best != null &&
      'fitness' in best &&
      typeof best.fitness === 'number'
    ) {
      bestFitness = best.fitness
    }

    const fitnessValues: number[] = []
    for (const organism of population.organismValues() as Iterable<{
      fitness: number | null
    }>) {
      if (organism.fitness != null) {
        fitnessValues.push(organism.fitness)
      }
    }
    if (fitnessValues.length > 0) {
      populationFitnessMean = mean(fitnessValues)
      populationFitnessMedian = median(fitnessValues)
    }

    const bestFilePath = await saveGenome(method, best, config.outputDir)

    return {
      mode: 'training',
      method,
      bestFitness,
      populationFitnessMean,
      populationFitnessMedian,
      bestOrganism,
      bestFilePath,
      generationsLogPath: resolveGenerationsLogPath(config.outputDir),
      genomesDir: join(config.outputDir ?? DEFAULT_OUTPUT_DIR, 'genomes'),
    }
  } finally {
    if (workerProfiles.length > 0) {
      const outputDir =
        options.workerCpuProfileDir ??
        join(config.outputDir ?? DEFAULT_OUTPUT_DIR, 'worker-cpu-profiles')
      await writeWorkerCpuProfiles(workerProfiles, outputDir)
      workerProfiles = []
    }
    for (const terminable of terminables) {
      await terminable.terminate()
    }
    terminables.clear()
  }
}
