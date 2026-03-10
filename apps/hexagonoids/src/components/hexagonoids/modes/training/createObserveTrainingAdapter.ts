import {
  buildEnvironmentOptions,
  createPhenotypeForGenome,
  createPopulationForTraining,
  createWorkerReproducerFactoryForMethod,
  getAlgorithmDefinition,
  MultiSeedGenerationStrategy,
  type SupportedAlgorithm,
  type TrainOptions,
} from '@heygrady/hexagonoids-demo'
import {
  type HexagonoidsEnvironmentConfig,
  INPUT_COUNT,
  mergeConfig,
  type ScenarioSnapshot,
} from '@heygrady/hexagonoids-environment'
import type {
  Environment,
  EnvironmentDescription,
} from '@neat-evolution/environment'
import type { AnyErasedGenome } from '@neat-evolution/evaluator'
import { defaultEvolutionOptions, evolve } from '@neat-evolution/evolution'
import type { Executor, SyncExecutor } from '@neat-evolution/executor'
import { createExecutor } from '@neat-evolution/executor'
import type { WorkerEvaluatorOptions } from '@neat-evolution/worker-evaluator'
import { WorkerEvaluator } from '@neat-evolution/worker-evaluator'
// eslint-disable-next-line import/default
import workerEvaluatorScriptUrl from '@neat-evolution/worker-evaluator/workerEvaluatorScript?worker&url'
import type { Terminable } from '@neat-evolution/worker-reproducer'
// eslint-disable-next-line import/default
import workerReproducerScriptUrl from '@neat-evolution/worker-reproducer/workerReproducerScript?worker&url'
import { hardwareConcurrency } from '@neat-evolution/worker-threads'
import { getModulePathnamesForAlgorithm } from './getModulePathnamesForAlgorithm'

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

function hasGenome(value: unknown): value is { genome: AnyErasedGenome } {
  return value != null && typeof value === 'object' && 'genome' in value
}

function normalizeThreadCount(value: number | undefined): number {
  if (value != null) return Math.max(1, Math.floor(value))
  return Math.max(1, Math.floor(hardwareConcurrency - 3))
}

function normalizeEvaluationSeedsPerOrganism(
  value: number | undefined
): number {
  if (value == null) return 1
  return Math.max(1, Math.floor(value))
}

function buildEnvironmentConfig(
  config: ObserveTrainingConfig,
  scenarioBank?: ScenarioSnapshot[]
): {
  config: HexagonoidsEnvironmentConfig
  description: EnvironmentDescription
} {
  const merged = mergeConfig(buildEnvironmentOptions(config, scenarioBank))
  return {
    config: merged,
    description: {
      inputs: INPUT_COUNT,
      outputs: 4,
    },
  }
}

function createBrowserWorkerEnvironment(
  envConfig: HexagonoidsEnvironmentConfig,
  description: EnvironmentDescription
): Environment<HexagonoidsEnvironmentConfig> {
  return {
    description,
    isAsync: false,
    evaluate(_executor: SyncExecutor): number {
      throw new Error('Browser worker environment should evaluate in workers')
    },
    evaluateBatch(_executors: SyncExecutor[]): number[] {
      throw new Error('Browser worker environment should evaluate in workers')
    },
    async evaluateAsync(_executor: Executor): Promise<number> {
      throw new Error('Browser worker environment should evaluate in workers')
    },
    async evaluateBatchAsync(_executors: Executor[]): Promise<number[]> {
      throw new Error('Browser worker environment should evaluate in workers')
    },
    toFactoryOptions(): HexagonoidsEnvironmentConfig {
      return envConfig
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

  const terminables = new Set<Terminable>()
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

  const terminateWorkers = async () => {
    for (const terminable of terminables) {
      await terminable.terminate()
    }
    terminables.clear()
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
      const evaluationSeedsPerOrganism = normalizeEvaluationSeedsPerOrganism(
        config.evaluationSeedsPerOrganism
      )
      const populationSize = config.populationSize ?? 64
      const {
        algorithmPathname,
        createEnvironmentPathname,
        createExecutorPathname,
      } = getModulePathnamesForAlgorithm(method)

      abortController = new AbortController()
      statusIntervalId = window.setInterval(() => {
        if (disposed) return
        emitStatus('training')
      }, 250)

      let scenarioBank: ScenarioSnapshot[] | undefined
      if (config.scenarioMode !== false) {
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
      const environment = createBrowserWorkerEnvironment(envConfig, description)

      const evaluatorOptions: WorkerEvaluatorOptions = {
        algorithmPathname,
        createEnvironmentPathname,
        createExecutorPathname,
        taskCount: populationSize,
        threadCount,
        workerScriptUrl: workerEvaluatorScriptUrl,
        strategy: new MultiSeedGenerationStrategy(
          evaluationSeedsPerOrganism,
          config.evaluationBaseSeed ?? 'observe-training'
        ),
      }
      const algorithm = getAlgorithmDefinition(method).createAlgorithm()
      const evaluator = new WorkerEvaluator(
        algorithm,
        environment,
        evaluatorOptions
      )
      terminables.add(evaluator)

      const createReproducer = createWorkerReproducerFactoryForMethod(
        method,
        {
          algorithmPathname,
          threadCount,
          workerScriptUrl: workerReproducerScriptUrl,
        },
        terminables
      )

      const population = createPopulationForTraining(method, {
        createReproducer,
        evaluator,
        populationSize,
      })

      runPromise = evolve(population, {
        ...defaultEvolutionOptions,
        iterations,
        threadCount,
        signal: abortController.signal,
        afterEvaluateInterval: 1,
        afterEvaluate: (activePopulation, iteration) => {
          if (disposed) return
          const generation = iteration + 1
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
        },
      })
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
          await terminateWorkers()
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
      } else {
        await terminateWorkers()
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
