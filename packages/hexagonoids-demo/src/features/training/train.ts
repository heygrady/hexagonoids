import { mkdirSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

import {
  type BehavioralGateConfig,
  doNothingAgent,
  type FitnessWeights,
  type GateConfig,
  type RawMetrics,
  type RuntimeScoringHooksConfig,
  randomAgent,
} from '@heygrady/hexagonoids-environment'
import { createEnvironment } from '@heygrady/hexagonoids-environment/node'
import { Activation, type OutputActivationSpec } from '@neat-evolution/core'
import { IndividualStrategy } from '@neat-evolution/evaluation-strategy'
import { defaultEvolutionOptions } from '@neat-evolution/evolution'
import {
  type EvaluatorConfig,
  EvolutionManager,
  type EvolutionManagerOptions,
} from '@neat-evolution/evolution-manager'
import type {
  A2CStepAgentConfig,
  ActorCriticStepAgentConfig,
  DeepQLearningStepAgentConfig,
  PPOStepAgentConfig,
  QLearningStepAgentConfig,
  StepRolloutBufferConfig,
  TrajectoryBatchCollectorConfig,
} from '@neat-evolution/rl-core'
import { createRNG } from '@neat-evolution/utils'
import { hardwareConcurrency } from '@neat-evolution/worker-threads'
import {
  appendGenerationLog,
  type GenerationLogEntry,
  resolveGenerationsLogPath,
  saveGenerationGenome,
} from '../persistence/appendGenerationLog.js'
import {
  DEFAULT_ARTIFACTS_DIR,
  PACKAGE_ROOT,
} from '../persistence/artifactPaths.js'
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

const DEFAULT_OUTPUT_DIR = DEFAULT_ARTIFACTS_DIR
const DEFAULT_METHOD: SupportedAlgorithm = 'NEAT'
const DEFAULT_BASE_SEED = 'hexagonoids-phase03'
const CREATE_ENVIRONMENT_PATHNAME = resolve(
  PACKAGE_ROOT,
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
    scenariosPerOrganism: options.scenariosPerOrganism ?? 64,
    scenarioMaxTicks: options.scenarioMaxTicks ?? 32,
    scenarioWeight: options.scenarioWeight,
    fullGameWeight: options.fullGameWeight,
    curriculumWeight: options.curriculumWeight,
    rlMode: options.rlMode ?? 'none',
    rlLearningRate: options.rlLearningRate ?? 0.001,
    rlIsLamarckian: options.rlIsLamarckian ?? true,
    rlRewardThreshold: options.rlRewardThreshold ?? 0.1,
    rlEpsilon: options.rlEpsilon ?? 0.3,
    rlEpsilonDecay: options.rlEpsilonDecay ?? 0.95,
    rlEpsilonMin: options.rlEpsilonMin ?? 0.01,
    rlMultiDiscrete: options.rlMultiDiscrete ?? true,
    rlEpochs: options.rlEpochs ?? 1,
    rlMinibatchSize: options.rlMinibatchSize ?? 128,
    rlBatchTransitions: options.rlBatchTransitions ?? 2048,
    rlReplayCapacity: options.rlReplayCapacity ?? 10000,
    rlReplayBatchSize: options.rlReplayBatchSize ?? 32,
    rlTargetSyncInterval: options.rlTargetSyncInterval ?? 100,
    rlWarmupGenerations: options.rlWarmupGenerations ?? 0,
    speciationThreshold: options.speciationThreshold,
    speciationThresholdMoveAmount: options.speciationThresholdMoveAmount,
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
  workerHeapProfiles?: boolean | undefined
  workerCpuProfileDir?: string | undefined
  signal?: AbortSignal | undefined
  scenariosPerOrganism?: number | undefined
  scenarioMaxTicks?: number | undefined
  curriculumCount?: number | undefined
  curriculumWeight?: number | undefined
  fitnessWeights?: FitnessWeights | undefined
  gateConfig?: Partial<GateConfig> | undefined
  behavioralGateConfig?: Partial<BehavioralGateConfig> | undefined
  runtimeHooks?: RuntimeScoringHooksConfig | undefined
  scenarioWeight?: number | undefined
  fullGameWeight?: number | undefined
  scenarioSeedsPerOrganism?: number | undefined
  fullGameSeedsPerOrganism?: number | undefined
  rlMode?: 'none' | 'actor-critic' | 'q-learning' | 'a2c' | 'dql' | 'ppo'
  rlLearningRate?: number | undefined
  rlIsLamarckian?: boolean | undefined
  rlRewardThreshold?: number | undefined
  rlEpsilon?: number | undefined
  rlEpsilonDecay?: number | undefined
  rlEpsilonMin?: number | undefined
  rlMultiDiscrete?: boolean | undefined
  rlEpochs?: number | undefined
  rlMinibatchSize?: number | undefined
  rlBatchTransitions?: number | undefined
  rlReplayCapacity?: number | undefined
  rlReplayBatchSize?: number | undefined
  rlTargetSyncInterval?: number | undefined
  rlRewardRock?: number | undefined
  rlRewardDeath?: number | undefined
  rlRewardSurvival?: number | undefined
  rlRewardEngagement?: number | undefined
  rlRewardProgress?: number | undefined
  rlRewardActionBand?: number | undefined
  rlRewardTurnConflict?: number | undefined
  rlRewardScoreScale?: number | undefined
  rlRewardShotPenalty?: number | undefined
  rlRewardBulletAim?: number | undefined
  rlRewardBulletAimOutOfRange?: number | undefined
  rlRewardBulletMissDemerit?: number | undefined
  rlRewardThrust?: number | undefined
  rlWarmupGenerations?: number | undefined
  speciationThreshold?: number | undefined
  speciationThresholdMoveAmount?: number | undefined
  stats?: import('@neat-evolution/stats').StatsRecorder | undefined
  afterEvaluate?: (population: unknown, iteration: number) => void
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

interface ActiveWorkerProfile {
  kind: string
  type: 'cpu' | 'heap'
  threadId: number
  stop: () => Promise<unknown>
}

// Keep the old name as alias for compatibility within this file
type ActiveWorkerCpuProfile = ActiveWorkerProfile

interface ProfileHandleLike {
  stop: () => Promise<unknown>
}

interface ProfilableNodeWorkerLike {
  threadId: number
  startCpuProfile: () => Promise<ProfileHandleLike>
  startHeapProfile?: () => Promise<ProfileHandleLike>
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
): Promise<ActiveWorkerProfile[]> {
  await waitForWorkerOwnerReady(owner)
  const workers = getOwnedNodeWorkers(owner)
  return await Promise.all(
    workers.map(async (worker) => {
      const handle = await worker.startCpuProfile()
      return {
        kind,
        type: 'cpu' as const,
        threadId: worker.threadId,
        stop: () => handle.stop(),
      }
    })
  )
}

async function startWorkerHeapProfilesForOwner(
  owner: unknown,
  kind: string
): Promise<ActiveWorkerProfile[]> {
  await waitForWorkerOwnerReady(owner)
  const workers = getOwnedNodeWorkers(owner)
  const results: ActiveWorkerProfile[] = []
  for (const worker of workers) {
    if (typeof worker.startHeapProfile !== 'function') continue
    const handle = await worker.startHeapProfile()
    results.push({
      kind,
      type: 'heap',
      threadId: worker.threadId,
      stop: () => handle.stop(),
    })
  }
  return results
}

async function writeWorkerProfiles(
  profiles: ActiveWorkerProfile[],
  outputDir: string
): Promise<void> {
  if (profiles.length === 0) return
  mkdirSync(outputDir, { recursive: true })

  const writes = profiles.map(async (profile) => {
    const data = await profile.stop()
    const ext = profile.type === 'heap' ? 'heapprofile' : 'cpuprofile'
    const pathname = join(
      outputDir,
      `${profile.kind}-worker-${profile.threadId}.${ext}`
    )
    writeFileSync(
      pathname,
      typeof data === 'string' ? data : JSON.stringify(data)
    )
  })
  await Promise.all(writes)
}

// --- Algorithm config for EvolutionManager ---

type ErasedManagerConfig = Pick<EvolutionManagerOptions, 'algorithm'>

function algorithmConfig(method: SupportedAlgorithm): ErasedManagerConfig {
  switch (method) {
    case 'NEAT':
      return {
        algorithm: {
          name: 'NEAT',
          configData: { neat: createHexagonoidsNEATConfigOptions() },
          genomeOptions: createHexagonoidsNEATGenomeOptions(),
        },
      }
    case 'CPPN':
      return {
        algorithm: {
          name: 'CPPN',
          configData: { neat: createHexagonoidsNEATConfigOptions() },
          genomeOptions: createHexagonoidsCPPNGenomeOptions(),
        },
      }
    case 'HyperNEAT':
      return {
        algorithm: {
          name: 'HyperNEAT',
          configData: { neat: createHexagonoidsNEATConfigOptions() },
          genomeOptions: createHexagonoidsHyperNEATGenomeOptions(),
        },
      }
    case 'ES-HyperNEAT':
      return {
        algorithm: {
          name: 'ES-HyperNEAT',
          configData: { neat: createHexagonoidsNEATConfigOptions() },
          genomeOptions: createHexagonoidsESHyperNEATGenomeOptions(),
        },
      }
    case 'DES-HyperNEAT':
      return {
        algorithm: {
          name: 'DES-HyperNEAT',
          configData: {
            neat: {},
            cppn: createHexagonoidsNEATConfigOptions(),
          } as never,
          genomeOptions: createHexagonoidsDESHyperNEATGenomeOptions(),
        },
      }
  }
}

const LEGACY_ACTION_COUNT = 4
const GROUPED_ACTION_FACTOR_SIZES = [2, 2, 3] as const
const GROUPED_ACTION_FACTOR_COUNT = GROUPED_ACTION_FACTOR_SIZES.length
const GROUPED_ACTION_OUTPUT_COUNT = GROUPED_ACTION_FACTOR_SIZES.reduce(
  (sum, size) => sum + size,
  0
)

/**
 * Determine genome output count and activation based on RL mode.
 * - Vanilla: 7 outputs, thrust(2) + fire(2) + turn(3)
 * - AC/A2C/PPO: 8 outputs (+ value head)
 * - QL multiDiscrete: 7 outputs, one categorical group per control factor
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
      outputCount: GROUPED_ACTION_OUTPUT_COUNT + 1,
      outputActivation: [
        [2, Activation.Softmax],
        [2, Activation.Softmax],
        [3, Activation.Softmax],
        [1, Activation.Linear],
      ],
    }
  }
  if (rlMode === 'a2c' || rlMode === 'ppo') {
    // Same layout as actor-critic: grouped categorical + value head
    return {
      outputCount: GROUPED_ACTION_OUTPUT_COUNT + 1,
      outputActivation: [
        [2, Activation.Softmax],
        [2, Activation.Softmax],
        [3, Activation.Softmax],
        [1, Activation.Linear],
      ],
    }
  }
  if (rlMode === 'q-learning' && rlMultiDiscrete) {
    return {
      outputCount: GROUPED_ACTION_OUTPUT_COUNT,
      outputActivation: Activation.Linear,
    }
  }
  if (rlMode === 'q-learning') {
    return {
      outputCount: LEGACY_ACTION_COUNT,
      outputActivation: Activation.Linear,
    }
  }
  if (rlMode === 'dql') {
    if (rlMultiDiscrete) {
      return {
        outputCount: GROUPED_ACTION_OUTPUT_COUNT,
        outputActivation: Activation.Linear,
      }
    }
    return {
      outputCount: LEGACY_ACTION_COUNT,
      outputActivation: Activation.Linear,
    }
  }
  // Vanilla: grouped categorical thrust(2) + fire(2) + turn(3)
  return {
    outputCount: GROUPED_ACTION_OUTPUT_COUNT,
    outputActivation: [
      [2, Activation.Softmax],
      [2, Activation.Softmax],
      [3, Activation.Softmax],
    ],
  }
}

/**
 * Build RL evaluator config with pathname-based agent factory injection.
 * Workers dynamically import the agent factory and wire it into the environment.
 */
function buildRLEvaluatorConfig(config: ReturnType<typeof toRunConfig>): {
  evaluation?: Partial<EvaluatorConfig>
  execution?: {
    createExecutionManager: string
    executionManagerFactoryOptions: Record<string, unknown>
  }
} {
  const rolloutConfig: StepRolloutBufferConfig = {
    rolloutLength: 32,
  }

  if (config.rlMode === 'actor-critic') {
    const acConfig: ActorCriticStepAgentConfig = {
      learningRate: config.rlLearningRate,
      actionCount: GROUPED_ACTION_FACTOR_COUNT,
      actionFactorSizes: GROUPED_ACTION_FACTOR_SIZES,
      multiDiscrete: true,
      gradientConfig: {
        discountFactor: 0.99,
        entropyCoefficient: 0.01,
        clipGradients: false,
        gradientClipValue: 1.0,
      },
      rolloutConfig,
    }
    return {
      evaluation: {
        createExecutorPathname: '@neat-evolution/executor/backprop',
      },
      execution: {
        createExecutionManager: '@neat-evolution/rl-core/actor-critic',
        executionManagerFactoryOptions: {
          config: acConfig,
          isLamarckian: config.rlIsLamarckian,
        },
      },
    }
  }

  if (config.rlMode === 'a2c') {
    const trajectoryConfig: TrajectoryBatchCollectorConfig = {
      rolloutLength: 32,
      batchTransitions: config.rlBatchTransitions,
    }
    const a2cConfig: A2CStepAgentConfig = {
      learningRate: config.rlLearningRate,
      actionCount: GROUPED_ACTION_FACTOR_COUNT,
      actionFactorSizes: GROUPED_ACTION_FACTOR_SIZES,
      multiDiscrete: true,
      discountFactor: 0.99,
      gaeLambda: 0.95,
      normalizeAdvantages: true,
      gradientConfig: {
        entropyCoefficient: 0.01,
        clipGradients: false,
        gradientClipValue: 1.0,
      },
      trajectoryConfig,
    }
    return {
      evaluation: {
        createExecutorPathname: '@neat-evolution/executor/backprop',
      },
      execution: {
        createExecutionManager: '@neat-evolution/rl-core/a2c',
        executionManagerFactoryOptions: {
          config: a2cConfig,
          isLamarckian: config.rlIsLamarckian,
        },
      },
    }
  }

  if (config.rlMode === 'q-learning') {
    const qlConfig: QLearningStepAgentConfig = {
      learningRate: config.rlLearningRate,
      actionCount: config.rlMultiDiscrete
        ? GROUPED_ACTION_FACTOR_COUNT
        : LEGACY_ACTION_COUNT,
      ...(config.rlMultiDiscrete && {
        actionFactorSizes: GROUPED_ACTION_FACTOR_SIZES,
      }),
      discountFactor: 0.99,
      rolloutConfig,
      epsilonInitial: config.rlEpsilon,
      epsilonDecayPerEpisode: config.rlEpsilonDecay,
      epsilonMinimum: config.rlEpsilonMin,
      multiDiscrete: config.rlMultiDiscrete,
    }
    return {
      evaluation: {
        createExecutorPathname: '@neat-evolution/executor/backprop',
      },
      execution: {
        createExecutionManager: '@neat-evolution/rl-core/q-learning',
        executionManagerFactoryOptions: {
          config: qlConfig,
          isLamarckian: config.rlIsLamarckian,
        },
      },
    }
  }

  if (config.rlMode === 'dql') {
    const dqlConfig: DeepQLearningStepAgentConfig = {
      learningRate: config.rlLearningRate,
      actionCount: config.rlMultiDiscrete
        ? GROUPED_ACTION_FACTOR_COUNT
        : LEGACY_ACTION_COUNT,
      ...(config.rlMultiDiscrete && {
        actionFactorSizes: GROUPED_ACTION_FACTOR_SIZES,
      }),
      multiDiscrete: config.rlMultiDiscrete,
      discountFactor: 0.99,
      epsilonInitial: config.rlEpsilon,
      epsilonDecayPerEpisode: config.rlEpsilonDecay,
      epsilonMinimum: config.rlEpsilonMin,
      replayCapacity: config.rlReplayCapacity,
      replayBatchSize: config.rlReplayBatchSize,
      replayWarmupSize: config.rlReplayBatchSize, // warm up = 1 batch
      targetSyncInterval: config.rlTargetSyncInterval,
    }
    return {
      evaluation: {
        createExecutorPathname: '@neat-evolution/executor/backprop',
      },
      execution: {
        createExecutionManager: '@neat-evolution/rl-core/dql',
        executionManagerFactoryOptions: {
          config: dqlConfig,
          isLamarckian: config.rlIsLamarckian,
        },
      },
    }
  }

  if (config.rlMode === 'ppo') {
    // Trajectory config: episode-aligned rollouts with large batches.
    // batchTransitions=2048 means training after ~32 scenarios or 1 full game.
    // Larger batches produce better GAE advantage estimates and allow more
    // epochs to extract signal without overfitting to small samples.
    const trajectoryConfig: TrajectoryBatchCollectorConfig = {
      rolloutLength: 'episode',
      batchTransitions: config.rlBatchTransitions,
    }
    const ppoConfig: PPOStepAgentConfig = {
      learningRate: config.rlLearningRate,
      actionCount: GROUPED_ACTION_FACTOR_COUNT,
      actionFactorSizes: GROUPED_ACTION_FACTOR_SIZES,
      multiDiscrete: true,
      discountFactor: 0.99,
      clipEpsilon: 0.2,
      entropyCoefficient: 0.01,
      valueLossCoefficient: 0.5,
      gaeLambda: 0.95,
      normalizeAdvantages: true,
      minibatchSize: config.rlMinibatchSize,
      epochs: config.rlEpochs,
      trajectoryConfig,
    }
    return {
      evaluation: {
        createExecutorPathname: '@neat-evolution/executor/backprop',
      },
      execution: {
        createExecutionManager: '@neat-evolution/rl-core/ppo',
        executionManagerFactoryOptions: {
          config: ppoConfig,
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
  if ((config.scenarioWeight ?? 0) > 0) {
    const { loadScenarioBank } = await import('../../data/scenarios.js')
    const loadedScenarioBank = await loadScenarioBank()
    if (loadedScenarioBank.length === 0) {
      throw new Error(
        'Scenario weight > 0 but no scenarios found. Run: yarn workspace @heygrady/hexagonoids-demo demo scenarios'
      )
    }
    scenarioBank = loadedScenarioBank
    console.log(
      `Scenarios: ${loadedScenarioBank.length} loaded, ${config.scenariosPerOrganism} per organism, ${config.scenarioMaxTicks} max ticks each`
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
  if (options.runtimeHooks != null) {
    const hookParts: string[] = []
    if (typeof options.runtimeHooks.reward === 'string') {
      hookParts.push(`reward=${options.runtimeHooks.reward}`)
    }
    if (typeof options.runtimeHooks.fitness === 'string') {
      hookParts.push(`fitness=${options.runtimeHooks.fitness}`)
    }
    if (hookParts.length > 0) {
      console.log(`Runtime hooks: ${hookParts.join(' ')}`)
    }
  }

  const algorithmDetails = algorithmConfig(method)
  // Override genomeOptions with RL-specific output activation
  if (
    config.rlMode !== 'none' &&
    algorithmDetails.algorithm.genomeOptions != null
  ) {
    const genomeOpts = algorithmDetails.algorithm.genomeOptions as Record<
      string,
      unknown
    >
    genomeOpts.outputActivation = rlOutputs.outputActivation
  }
  const runtimeConfig = buildRLEvaluatorConfig(config)
  const evaluatorConfig: EvaluatorConfig = {
    taskCount: config.populationSize,
    threadCount: config.threadCount,
    ...(runtimeConfig.evaluation ?? {}),
  }

  const strategy = new IndividualStrategy()

  // ── Shared helpers for warmup + main phase ──

  const handleNewBest = (organism: unknown) => {
    bestOrganism = organism
    if (
      organism != null &&
      typeof organism === 'object' &&
      'fitness' in organism &&
      typeof organism.fitness === 'number'
    ) {
      bestFitness = organism.fitness
    }
  }

  const createAfterEvaluate = (generationOffset: number) => {
    return (
      activePopulation: { best: () => { fitness: number | null } | null },
      iteration: number
    ) => {
      const generation = generationOffset + iteration
      const best = activePopulation.best()
      if (best == null) return

      const entry: GenerationLogEntry = {
        generation,
        method,
        bestFitness: best.fitness ?? 0,
        seeds: generationSeedPack(
          generation,
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
        generation,
        config.outputDir
      )
        .then(() => ({ ok: true }) as const)
        .catch((error) => ({ ok: false, error }) as const)
      pendingGenerationWrites.push(genomeWrite)

      if (options.afterEvaluate != null) {
        options.afterEvaluate(activePopulation, generation)
      }
    }
  }

  const populationOptions = {
    populationSize: config.populationSize,
    ...(config.speciationThreshold != null && {
      speciationThreshold: config.speciationThreshold,
    }),
    ...(config.speciationThresholdMoveAmount != null && {
      speciationThresholdMoveAmount: config.speciationThresholdMoveAmount,
    }),
  }

  const environmentConfig = {
    config: environment,
    pathname: CREATE_ENVIRONMENT_PATHNAME,
  }

  // ── Warmup phase: Baldwinian RL (evaluate with PPO but don't write back) ──

  const warmupGenerations = config.rlWarmupGenerations
  const useWarmup = warmupGenerations > 0 && config.rlMode !== 'none'
  let restoredPopulationFactoryOptions: unknown | undefined
  let generationOffset = 0

  if (useWarmup) {
    // Baldwinian warmup: PPO improves the fitness signal but weights are NOT
    // written back.  This selects for organisms that respond well to gradient
    // updates — a "learnability" filter — without the weight divergence that
    // breaks speciation.
    const warmupEvaluatorConfig: EvaluatorConfig = {
      taskCount: config.populationSize,
      threadCount: config.threadCount,
      ...(runtimeConfig.evaluation ?? {}),
    }

    const warmupExecution =
      runtimeConfig.execution != null
        ? {
            createExecutionManager:
              runtimeConfig.execution.createExecutionManager,
            executionManagerFactoryOptions: {
              ...runtimeConfig.execution.executionManagerFactoryOptions,
              isLamarckian: false,
            },
          }
        : undefined

    console.log(
      `[WARMUP] Running ${warmupGenerations} Baldwinian ${config.rlMode} generations (no weight write-back)...`
    )

    const warmupManager = new EvolutionManager({
      ...algorithmDetails,
      environment: environmentConfig,
      population: { options: populationOptions },
      evolution: {
        iterations: warmupGenerations,
        secondsLimit: 0,
        earlyStop: false,
        logInterval: config.logInterval,
        handleNewBest,
        afterEvaluate: createAfterEvaluate(0),
      },
      evaluation: {
        strategy,
        options: warmupEvaluatorConfig,
        ...(options.stats != null ? { stats: options.stats } : {}),
      },
      ...(warmupExecution != null ? { execution: warmupExecution } : {}),
      ...(config.signal != null ? { signal: config.signal } : {}),
      rng: createRNG(config.baseSeed),
    })

    await warmupManager.init()
    await warmupManager.evolve()

    const popData = warmupManager.getPopulationData()
    restoredPopulationFactoryOptions = popData.factoryOptions
    generationOffset = warmupGenerations

    await warmupManager.terminate()
    console.log(
      `[WARMUP] Completed ${warmupGenerations} Baldwinian warmup generations. Switching to Lamarckian ${config.rlMode}...`
    )
  }

  // ── Main phase (with RL if configured, or only phase if no warmup) ──

  const remainingIterations = useWarmup
    ? config.iterations - warmupGenerations
    : config.iterations

  // Slightly relax speciation threshold for RL phases to absorb weight
  // divergence from backprop updates (0.9 vs default 0.8).
  const rlPopulationOptions =
    config.rlMode !== 'none' && config.speciationThreshold == null
      ? { ...populationOptions, speciationThreshold: 0.9 }
      : populationOptions

  const manager = new EvolutionManager({
    ...algorithmDetails,
    environment: environmentConfig,
    population: {
      options: rlPopulationOptions,
      ...(restoredPopulationFactoryOptions != null
        ? { factoryOptions: restoredPopulationFactoryOptions as never }
        : {}),
    },
    evolution: {
      iterations: remainingIterations,
      secondsLimit: config.secondsLimit,
      earlyStop: true,
      earlyStopPatience: config.earlyStopPatience,
      logInterval: config.logInterval,
      ...(useWarmup ? { initialMutations: 0 } : {}),
      handleNewBest,
      afterEvaluate: createAfterEvaluate(generationOffset),
    },
    evaluation: {
      strategy,
      options: evaluatorConfig,
      ...(options.stats != null ? { stats: options.stats } : {}),
    },
    ...(runtimeConfig.execution != null
      ? {
          execution: runtimeConfig.execution,
        }
      : {}),
    ...(config.signal != null ? { signal: config.signal } : {}),
    rng: createRNG(useWarmup ? `${config.baseSeed}:rl` : config.baseSeed),
  })

  // Initialize the manager to create workers before starting CPU profiles
  await manager.init()

  if (options.workerCpuProfiles || options.workerHeapProfiles) {
    const population = manager.currentPopulation
    const evaluator = population != null ? population.evaluator : null
    const reproducer = population != null ? population.reproducer : null
    const profileStarts: Array<Promise<ActiveWorkerProfile[]>> = []
    if (options.workerCpuProfiles) {
      profileStarts.push(startWorkerCpuProfilesForOwner(evaluator, 'evaluator'))
      profileStarts.push(
        startWorkerCpuProfilesForOwner(reproducer, 'reproducer')
      )
    }
    if (options.workerHeapProfiles) {
      profileStarts.push(
        startWorkerHeapProfilesForOwner(evaluator, 'evaluator')
      )
      profileStarts.push(
        startWorkerHeapProfilesForOwner(reproducer, 'reproducer')
      )
    }
    const profiledWorkers = await Promise.all(profileStarts)
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
      await writeWorkerProfiles(workerProfiles, outputDir)
      workerProfiles = []
    }
    await manager.terminate()
  }
}
