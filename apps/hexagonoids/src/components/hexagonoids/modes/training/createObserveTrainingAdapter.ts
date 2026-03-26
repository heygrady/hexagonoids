import {
  buildEnvironmentOptions,
  createHexagonoidsCPPNGenomeOptions,
  createHexagonoidsDESHyperNEATGenomeOptions,
  createHexagonoidsESHyperNEATGenomeOptions,
  createHexagonoidsHyperNEATGenomeOptions,
  createHexagonoidsNEATConfigOptions,
  createHexagonoidsNEATGenomeOptions,
  createPhenotypeForGenome,
  type SupportedAlgorithm,
  type TrainOptions,
} from '@heygrady/hexagonoids-demo'
import {
  type HexagonoidsEnvironmentConfig,
  INPUT_COUNT,
  mergeConfig,
  type ScenarioSnapshot,
} from '@heygrady/hexagonoids-environment'
import { Activation, type OutputActivationSpec } from '@neat-evolution/core'
import { defaultTopologyConfigOptions } from '@neat-evolution/des-hyperneat'
import type { EnvironmentDescription } from '@neat-evolution/environment'
import type { AnyErasedGenome } from '@neat-evolution/evaluator'
import {
  EvolutionManager,
  type EvolutionManagerOptions,
} from '@neat-evolution/evolution-manager'
import { createExecutor } from '@neat-evolution/executor'
import { hardwareConcurrency } from '@neat-evolution/worker-threads'
import { createBrowserWorkerConfig } from '../../../shared/neatWorkers/createBrowserWorkerConfig.js'

export interface ObserveGenerationBestEvent {
  generation: number
  fitness: number
  organism: unknown
  elapsedMs: number
}

export interface ObserveTrainingStatusEvent {
  phase: 'starting' | 'training' | 'stopped' | 'completed' | 'error'
  generationTarget: number
  elapsedMs: number
  message?: string
}

export interface ObserveTrainingConfig extends Partial<TrainOptions> {
  evaluationBaseSeed?: string
}

export interface ObserveTrainingAdapter {
  start(config: ObserveTrainingConfig): Promise<void>
  stop(): Promise<void>
  onGenerationBest(cb: (evt: ObserveGenerationBestEvent) => void): () => void
  onStatus(cb: (evt: ObserveTrainingStatusEvent) => void): () => void
}

const DEFAULT_OBSERVE_METHOD: SupportedAlgorithm = 'HyperNEAT'
const modules = import.meta.glob('./modules/*.ts')

function hasGenome(value: unknown): value is { genome: AnyErasedGenome } {
  return value != null && typeof value === 'object' && 'genome' in value
}

function normalizeThreadCount(value: number | undefined): number {
  if (value != null) return Math.max(1, Math.floor(value))
  return Math.max(1, Math.floor(hardwareConcurrency - 3))
}

/** PPO uses 4 actions × 2 (paired softmax) + 1 value head = 9 outputs. */
const ACTION_COUNT = 4
const PPO_OUTPUT_COUNT = ACTION_COUNT * 2 + 1
const PPO_OUTPUT_ACTIVATION: OutputActivationSpec = [
  [2, Activation.Softmax],
  [2, Activation.Softmax],
  [2, Activation.Softmax],
  [2, Activation.Softmax],
  [1, Activation.Linear],
]

function buildEnvironmentConfig(
  config: ObserveTrainingConfig,
  scenarioBank?: ScenarioSnapshot[]
): {
  config: HexagonoidsEnvironmentConfig
  description: EnvironmentDescription
} {
  const outputCount = config.rlMode === 'ppo' ? PPO_OUTPUT_COUNT : undefined
  const merged = mergeConfig(
    buildEnvironmentOptions(config, scenarioBank, outputCount)
  )
  return {
    config: merged,
    description: {
      inputs: INPUT_COUNT,
      outputs: outputCount ?? 4,
    },
  }
}

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
            neat: defaultTopologyConfigOptions,
            cppn: createHexagonoidsNEATConfigOptions(),
          } as never,
          genomeOptions: createHexagonoidsDESHyperNEATGenomeOptions(),
        },
      }
  }
}

function buildPPOExecutionConfig(
  workerConfig: ReturnType<typeof createBrowserWorkerConfig>,
  config: ObserveTrainingConfig
): { createExecutionManager: string; executionManagerFactoryOptions: Record<string, unknown> } | undefined {
  const evalConfig = workerConfig.evaluatorConfig as Record<string, unknown>
  const ppoPathname = evalConfig.createPPOExecutionManagerPathname as
    | string
    | undefined
  if (ppoPathname == null) {
    console.warn('[OBSERVE] PPO execution manager pathname not found')
    return undefined
  }

  const ppoConfig = {
    learningRate: config.rlLearningRate ?? 0.001,
    actionCount: ACTION_COUNT,
    multiDiscrete: true,
    discountFactor: 0.99,
    clipEpsilon: 0.2,
    entropyCoefficient: 0.01,
    valueLossCoefficient: 0.5,
    gaeLambda: 0.95,
    normalizeAdvantages: true,
    trajectoryConfig: {
      rolloutLength: 'episode' as const,
    },
  }

  return {
    createExecutionManager: ppoPathname,
    executionManagerFactoryOptions: {
      config: ppoConfig,
      isLamarckian: true,
    },
  }
}

export function createObserveTrainingAdapter(): ObserveTrainingAdapter {
  let disposed = false
  let runPromise: Promise<void> | null = null
  let abortController: AbortController | null = null
  let statusIntervalId: number | null = null
  let generationTarget = 1
  let startedAt = 0
  let currentManager: EvolutionManager | null = null

  const bestListeners = new Set<(evt: ObserveGenerationBestEvent) => void>()
  const statusListeners = new Set<(evt: ObserveTrainingStatusEvent) => void>()

  const emitBest = (evt: ObserveGenerationBestEvent) => {
    for (const listener of bestListeners) listener(evt)
  }

  const emitStatus = (
    phase: ObserveTrainingStatusEvent['phase'],
    message?: string
  ) => {
    const elapsedMs = startedAt > 0 ? performance.now() - startedAt : 0
    const evt: ObserveTrainingStatusEvent = {
      phase,
      generationTarget,
      elapsedMs,
      ...(message != null && { message }),
    }
    for (const listener of statusListeners) listener(evt)
  }

  const clearStatusTimer = () => {
    if (statusIntervalId == null) return
    clearInterval(statusIntervalId)
    statusIntervalId = null
  }

  return {
    async start(config) {
      await this.stop()
      disposed = false
      startedAt = performance.now()
      generationTarget = 1
      emitStatus('starting')

      const method = config.method ?? DEFAULT_OBSERVE_METHOD
      const iterations = config.iterations ?? 500
      const threadCount = normalizeThreadCount(config.threadCount)
      const populationSize = config.populationSize ?? 64
      const workerConfig = createBrowserWorkerConfig(
        modules,
        method,
        threadCount,
        'Observe training'
      )

      abortController = new AbortController()
      statusIntervalId = window.setInterval(() => {
        if (disposed) return
        emitStatus('training')
      }, 250)

      let scenarioBank: ScenarioSnapshot[] | undefined
      if ((config.scenarioWeight ?? 0) > 0) {
        try {
          const { loadScenarioBank } = await import(
            '@heygrady/hexagonoids-demo/data/scenarios'
          )
          scenarioBank = await loadScenarioBank()
          console.log(`[OBSERVE] Loaded ${scenarioBank.length} scenarios`)
        } catch (error) {
          console.warn(
            '[OBSERVE] Failed to load scenarios, falling back to full-game evaluation',
            error
          )
        }
      }

      const { config: envConfig, description } = buildEnvironmentConfig(
        config,
        scenarioBank
      )

      const rlMode = config.rlMode === 'ppo' ? 'ppo' : 'none'

      // Build algorithm config, overriding output activation for RL
      const algoConfig = algorithmConfig(method)
      if (
        rlMode === 'ppo' &&
        algoConfig.algorithm.genomeOptions != null
      ) {
        const genomeOpts = algoConfig.algorithm.genomeOptions as Record<
          string,
          unknown
        >
        genomeOpts.outputActivation = PPO_OUTPUT_ACTIVATION
      }

      // Build evaluator config — RL overrides the executor pathname
      const evalConfig = workerConfig.evaluatorConfig as Record<string, unknown>
      const evaluatorOptions = { ...workerConfig.evaluatorConfig }
      if (rlMode === 'ppo') {
        const backpropPathname =
          evalConfig.createExecutorBackpropPathname as string | undefined
        if (backpropPathname != null) {
          evaluatorOptions.createExecutorPathname = backpropPathname
        }
      }

      // Build execution config for RL
      const executionConfig =
        rlMode === 'ppo'
          ? buildPPOExecutionConfig(workerConfig, config)
          : undefined

      // ── Shared helpers for warmup + main phase ──

      const environmentOptions = {
        config: {
          description,
          toFactoryOptions: () => envConfig,
        },
        pathname: workerConfig.createEnvironmentPathname,
      }

      const createAfterEvaluate = (generationOffset: number) => {
        return (
          activePopulation: { best: () => { fitness: number | null } | null },
          iteration: number
        ) => {
          if (disposed) return
          const generation = generationOffset + iteration + 1
          const best = activePopulation.best()
          generationTarget = Math.min(iterations, generation + 1)
          emitStatus('training')

          if (best?.fitness == null) return
          emitBest({
            generation,
            fitness: best.fitness,
            organism: best,
            elapsedMs: performance.now() - startedAt,
          })
        }
      }

      // ── Warmup phase: Baldwinian PPO (evaluate with PPO but don't write back) ──

      const warmupGenerations = config.rlWarmupGenerations ?? 0
      const useWarmup = warmupGenerations > 0 && rlMode === 'ppo'
      let restoredPopulationFactoryOptions: unknown | undefined

      if (useWarmup) {
        console.log(
          `[OBSERVE] Running ${warmupGenerations} Baldwinian PPO warmup generations (no weight write-back)...`
        )

        // Baldwinian execution: same PPO config but isLamarckian = false
        const warmupExecution =
          executionConfig != null
            ? {
                createExecutionManager: executionConfig.createExecutionManager,
                executionManagerFactoryOptions: {
                  ...executionConfig.executionManagerFactoryOptions,
                  isLamarckian: false,
                },
              }
            : undefined

        const warmupManager = new EvolutionManager({
          ...algoConfig,
          environment: environmentOptions,
          evolution: {
            iterations: warmupGenerations,
            earlyStop: false,
            afterEvaluateInterval: 1,
            afterEvaluate: createAfterEvaluate(0),
          },
          population: {
            options: { populationSize },
          },
          evaluation: {
            options: evaluatorOptions,
          },
          ...(warmupExecution != null ? { execution: warmupExecution } : {}),
          signal: abortController.signal,
        })
        currentManager = warmupManager

        await warmupManager.evolve()

        const popData = warmupManager.getPopulationData()
        restoredPopulationFactoryOptions = popData.factoryOptions

        await warmupManager.terminate()
        currentManager = null
        console.log(
          `[OBSERVE] Baldwinian warmup complete. Switching to Lamarckian PPO for remaining ${iterations - warmupGenerations} generations...`
        )
      }

      // ── Main phase ──

      const remainingIterations = useWarmup
        ? iterations - warmupGenerations
        : iterations
      const generationOffset = useWarmup ? warmupGenerations : 0

      // Slightly relax speciation threshold for RL to absorb weight divergence
      const rlPopulationOptions =
        rlMode === 'ppo'
          ? { populationSize, speciationThreshold: 0.9 }
          : { populationSize }

      const manager = new EvolutionManager({
        ...algoConfig,
        environment: environmentOptions,
        evolution: {
          iterations: remainingIterations,
          ...(useWarmup ? { initialMutations: 0 } : {}),
          afterEvaluateInterval: 1,
          afterEvaluate: createAfterEvaluate(generationOffset),
        },
        population: {
          options: rlPopulationOptions,
          ...(restoredPopulationFactoryOptions != null
            ? { factoryOptions: restoredPopulationFactoryOptions as never }
            : {}),
        },
        evaluation: {
          options: evaluatorOptions,
        },
        ...(executionConfig != null ? { execution: executionConfig } : {}),
        signal: abortController.signal,
      })
      currentManager = manager

      runPromise = manager
        .evolve()
        .then(() => {
          if (disposed) return
          generationTarget = iterations
          emitStatus('completed')
        })
        .catch((error: unknown) => {
          if (disposed) return
          if (
            error instanceof Error &&
            (error.name === 'AbortError' || error.message === 'Aborted')
          ) {
            emitStatus('stopped')
            return
          }
          const message =
            error instanceof Error ? error.message : 'Unknown training error'
          emitStatus('error', message)
        })
        .finally(async () => {
          clearStatusTimer()
          await manager.terminate()
          currentManager = null
          runPromise = null
          abortController = null
        })
    },

    async stop() {
      disposed = true
      clearStatusTimer()
      abortController?.abort()
      if (runPromise != null) {
        await runPromise
      } else if (currentManager != null) {
        await currentManager.terminate()
        currentManager = null
      }
      emitStatus('stopped')
    },

    onGenerationBest(cb) {
      bestListeners.add(cb)
      return () => {
        bestListeners.delete(cb)
      }
    },

    onStatus(cb) {
      statusListeners.add(cb)
      return () => {
        statusListeners.delete(cb)
      }
    },
  }
}

export function organismToExecutor(
  method: SupportedAlgorithm,
  organism: unknown
) {
  if (!hasGenome(organism)) {
    throw new Error('Observe training: organism is missing genome data')
  }
  return createExecutor(
    createPhenotypeForGenome(method, organism.genome) as never
  )
}
