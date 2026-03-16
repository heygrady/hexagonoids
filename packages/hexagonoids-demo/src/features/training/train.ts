import { mkdirSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  doNothingAgent,
  type FitnessWeights,
  type GateConfig,
  type RawMetrics,
  randomAgent,
} from '@heygrady/hexagonoids-environment'
import { createEnvironment } from '@heygrady/hexagonoids-environment/node'
import type { ACAgentConfig } from '@neat-evolution/actor-critic'
import { Activation, type OutputActivationSpec } from '@neat-evolution/core'
import { CPPNAlgorithm } from '@neat-evolution/cppn'
import {
  DESHyperNEATAlgorithm,
  defaultTopologyConfigOptions,
} from '@neat-evolution/des-hyperneat'
import { ESHyperNEATAlgorithm } from '@neat-evolution/es-hyperneat'
import { defaultEvolutionOptions } from '@neat-evolution/evolution'
import {
  type EvaluatorConfig,
  EvolutionManager,
  type EvolutionManagerConfig,
} from '@neat-evolution/evolution-manager'
import type { RolloutBufferConfig } from '@neat-evolution/execution-manager'
import { HyperNEATAlgorithm } from '@neat-evolution/hyperneat'
import { NEATAlgorithm } from '@neat-evolution/neat'
import type { QLAgentConfig } from '@neat-evolution/q-learning'
import { hardwareConcurrency } from '@neat-evolution/worker-threads'
import {
  appendGenerationLog,
  type GenerationLogEntry,
  resolveGenerationsLogPath,
  saveGenerationGenome,
} from '../persistence/appendGenerationLog.js'
import { saveGenome } from '../persistence/saveGenome.js'
import {
  createHexagonoidsCPPNGenomeOptions,
  createHexagonoidsDESHyperNEATGenomeOptions,
  createHexagonoidsESHyperNEATGenomeOptions,
  createHexagonoidsHyperNEATGenomeOptions,
  createHexagonoidsNEATConfigOptions,
  createHexagonoidsNEATGenomeOptions,
  type SupportedAlgorithm,
} from '../registries/algorithmRegistry.js'
import { buildEnvironmentOptions } from '../runtime/buildEnvironmentOptions.js'
import { summarizeBaselineAgent } from './evaluation/baselines.js'
import { mean, median } from './evaluation/metrics.js'
import { generationSeedPack } from './evaluation/seedSchedule.js'
import { GenerationSeededStrategy } from './GenerationSeededStrategy.js'

const DEFAULT_OUTPUT_DIR = fileURLToPath(new URL('../../../', import.meta.url))
const DEFAULT_METHOD: SupportedAlgorithm = 'NEAT'
const DEFAULT_BASE_SEED = 'hexagonoids-phase03'
const CREATE_ENVIRONMENT_PATHNAME = resolve(
  DEFAULT_OUTPUT_DIR,
  '../hexagonoids-environment/dist/esm/node.js'
)
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
    rlMode: options.rlMode ?? 'none',
    rlLearningRate: options.rlLearningRate ?? 0.01,
    rlIsLamarckian: options.rlIsLamarckian ?? true,
    rlRewardThreshold: options.rlRewardThreshold ?? 0.1,
    rlEpsilon: options.rlEpsilon ?? 0.3,
    rlEpsilonDecay: options.rlEpsilonDecay ?? 0.95,
    rlEpsilonMin: options.rlEpsilonMin ?? 0.01,
    rlMultiDiscrete: options.rlMultiDiscrete ?? true,
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
  rlMode?: 'none' | 'actor-critic' | 'q-learning'
  rlLearningRate?: number | undefined
  rlIsLamarckian?: boolean | undefined
  rlRewardThreshold?: number | undefined
  rlEpsilon?: number | undefined
  rlEpsilonDecay?: number | undefined
  rlEpsilonMin?: number | undefined
  rlMultiDiscrete?: boolean | undefined
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

// --- Algorithm config for EvolutionManager ---

type ErasedManagerConfig = Pick<
  EvolutionManagerConfig,
  'algorithm' | 'configData' | 'genomeOptions'
>

function algorithmConfig(method: SupportedAlgorithm): ErasedManagerConfig {
  switch (method) {
    case 'NEAT':
      return {
        algorithm: NEATAlgorithm,
        configData: { neat: createHexagonoidsNEATConfigOptions() },
        genomeOptions: createHexagonoidsNEATGenomeOptions(),
      } as unknown as ErasedManagerConfig
    case 'CPPN':
      return {
        algorithm: CPPNAlgorithm,
        configData: { neat: createHexagonoidsNEATConfigOptions() },
        genomeOptions: createHexagonoidsCPPNGenomeOptions(),
      } as unknown as ErasedManagerConfig
    case 'HyperNEAT':
      return {
        algorithm: HyperNEATAlgorithm,
        configData: { neat: createHexagonoidsNEATConfigOptions() },
        genomeOptions: createHexagonoidsHyperNEATGenomeOptions(),
      } as unknown as ErasedManagerConfig
    case 'ES-HyperNEAT':
      return {
        algorithm: ESHyperNEATAlgorithm,
        configData: { neat: createHexagonoidsNEATConfigOptions() },
        genomeOptions: createHexagonoidsESHyperNEATGenomeOptions(),
      } as unknown as ErasedManagerConfig
    case 'DES-HyperNEAT':
      return {
        algorithm: DESHyperNEATAlgorithm,
        configData: {
          neat: defaultTopologyConfigOptions,
          cppn: createHexagonoidsNEATConfigOptions(),
        },
        genomeOptions: createHexagonoidsDESHyperNEATGenomeOptions(),
      } as unknown as ErasedManagerConfig
  }
}

const ACTION_COUNT = 4

/**
 * Determine genome output count and activation based on RL mode.
 * - Vanilla: 8 outputs, 4 × [2, Softmax] (paired softmax per action)
 * - AC: 9 outputs (4 × [2, Softmax] + [1, Linear])
 * - QL multiDiscrete: 8 outputs (2 Q-values per action), Linear
 * - QL flat: 4 outputs, Linear
 */
function rlOutputConfig(
  rlMode: string,
  rlMultiDiscrete: boolean
): {
  outputCount: number
  outputActivation: OutputActivationSpec
} {
  if (rlMode === 'actor-critic') {
    return {
      outputCount: ACTION_COUNT * 2 + 1,
      outputActivation: [
        [2, Activation.Softmax],
        [2, Activation.Softmax],
        [2, Activation.Softmax],
        [2, Activation.Softmax],
        [1, Activation.Linear],
      ],
    }
  }
  if (rlMode === 'q-learning' && rlMultiDiscrete) {
    return {
      outputCount: ACTION_COUNT * 2,
      outputActivation: Activation.Linear,
    }
  }
  if (rlMode === 'q-learning') {
    return {
      outputCount: ACTION_COUNT,
      outputActivation: Activation.Linear,
    }
  }
  // Vanilla: paired softmax (4 actions × 2 outputs each)
  return {
    outputCount: ACTION_COUNT * 2,
    outputActivation: [
      [2, Activation.Softmax],
      [2, Activation.Softmax],
      [2, Activation.Softmax],
      [2, Activation.Softmax],
    ],
  }
}

/**
 * Build RL evaluator config with pathname-based agent factory injection.
 * Workers dynamically import the agent factory and wire it into the environment.
 */
function buildRLEvaluatorConfig(
  config: ReturnType<typeof toRunConfig>
): Partial<EvaluatorConfig> {
  const rolloutConfig: RolloutBufferConfig = {
    rolloutLength: 'episode',
    rewardThreshold: config.rlRewardThreshold,
  }

  if (config.rlMode === 'actor-critic') {
    const acConfig: ACAgentConfig = {
      learningRate: config.rlLearningRate,
      actionCount: ACTION_COUNT,
      gradientConfig: {
        discountFactor: 0.99,
        entropyCoefficient: 0.01,
        clipGradients: false,
        gradientClipValue: 1.0,
      },
      rolloutConfig,
      multiDiscrete: true,
    }
    return {
      createExecutorPathname: '@neat-evolution/executor/backprop',
      hydrateEnvironmentOptions: {
        createAgent: '@neat-evolution/actor-critic/plugin',
      },
      environmentRuntimeData: {
        agentFactoryOptions: {
          config: acConfig,
          rngSeed: config.baseSeed,
          isLamarckian: config.rlIsLamarckian,
        },
      },
    }
  }

  if (config.rlMode === 'q-learning') {
    const qlConfig: QLAgentConfig = {
      learningRate: config.rlLearningRate,
      actionCount: ACTION_COUNT,
      discountFactor: 0.99,
      rolloutConfig,
      epsilonInitial: config.rlEpsilon,
      epsilonDecayPerEpisode: config.rlEpsilonDecay,
      epsilonMinimum: config.rlEpsilonMin,
      multiDiscrete: config.rlMultiDiscrete,
    }
    return {
      createExecutorPathname: '@neat-evolution/executor/backprop',
      hydrateEnvironmentOptions: {
        createAgent: '@neat-evolution/q-learning/plugin',
      },
      environmentRuntimeData: {
        agentFactoryOptions: {
          config: qlConfig,
          rngSeed: config.baseSeed,
          isLamarckian: config.rlIsLamarckian,
        },
      },
    }
  }

  return {}
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
    const { loadScenarioBank } = await import('../../data/scenarios.js')
    const loadedScenarioBank = await loadScenarioBank()
    if (loadedScenarioBank.length === 0) {
      throw new Error(
        'Scenario mode enabled but no scenarios found. Run: yarn workspace @heygrady/hexagonoids-demo demo scenarios'
      )
    }
    scenarioBank = loadedScenarioBank
    console.log(
      `Scenario mode: ${loadedScenarioBank.length} scenarios loaded, ${config.scenariosPerOrganism} per organism, ${config.scenarioMaxTicks} max ticks each`
    )
  }

  const rlOutputs = rlOutputConfig(config.rlMode, config.rlMultiDiscrete)

  const environment = createEnvironment(
    buildEnvironmentOptions(
      { ...options, ...config },
      scenarioBank,
      rlOutputs.outputCount
    )
  )

  const algorithmDetails = algorithmConfig(method)
  // Override genomeOptions with RL-specific output activation
  if (config.rlMode !== 'none' && algorithmDetails.genomeOptions != null) {
    const genomeOpts = algorithmDetails.genomeOptions as Record<string, unknown>
    genomeOpts.outputActivation = rlOutputs.outputActivation
  }
  const evaluatorConfig: EvaluatorConfig = {
    taskCount: config.populationSize,
    threadCount: config.threadCount,
    ...buildRLEvaluatorConfig(config),
  }

  const strategy = new GenerationSeededStrategy(config.baseSeed)

  const manager = new EvolutionManager({
    ...algorithmDetails,
    environment,
    createEnvironmentPathname: CREATE_ENVIRONMENT_PATHNAME,
    strategy,
    evaluatorConfig,
    evolutionOptions: {
      iterations: config.iterations,
      secondsLimit: config.secondsLimit,
      earlyStop: true,
      earlyStopPatience: config.earlyStopPatience,
      logInterval: config.logInterval,
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
      afterEvaluate: (activePopulation, iteration) => {
        const best = activePopulation.best()
        if (best == null) return

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
    },
    populationOptions: {
      populationSize: config.populationSize,
    },
    ...(config.signal != null && { signal: config.signal }),
  })

  // Initialize the manager to create workers before starting CPU profiles
  await manager.init()

  if (options.workerCpuProfiles) {
    const population = manager.currentPopulation
    const evaluator = population != null ? population.evaluator : null
    const reproducer = population != null ? population.reproducer : null
    const profiledWorkers = await Promise.all([
      startWorkerCpuProfilesForOwner(evaluator, 'evaluator'),
      startWorkerCpuProfilesForOwner(reproducer, 'reproducer'),
    ])
    workerProfiles = profiledWorkers.flat()
  }

  try {
    await manager.evolve()

    const population = manager.currentPopulation
    const best = bestOrganism ?? population?.best()
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
    if (population != null) {
      for (const organism of population.organismValues() as Iterable<{
        fitness: number | null
      }>) {
        if (organism.fitness != null) {
          fitnessValues.push(organism.fitness)
        }
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
    await manager.terminate()
  }
}
