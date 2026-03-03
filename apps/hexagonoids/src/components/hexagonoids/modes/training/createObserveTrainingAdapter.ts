import {
  createPhenotypeForGenome,
  createPopulationForTraining,
  createWorkerReproducerFactoryForMethod,
  getAlgorithmDefinition,
  MultiSeedGenerationStrategy,
  type SupportedAlgorithm,
} from '@heygrady/hexagonoids-demo'
import {
  decodeScenarioBankDocument,
  type EncodingPreset,
  getInputCountForEncoding,
  type HexagonoidsEnvironmentConfig,
  mergeConfig,
  type ScenarioSnapshot,
} from '@heygrady/hexagonoids-environment'
import type {
  Environment,
  EnvironmentDescription,
} from '@neat-evolution/environment'
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

export interface ObserveTrainingConfig {
  method?: SupportedAlgorithm
  encodingPreset?: EncodingPreset
  maxGenerations: number
  populationSize: number
  evaluationSeedsPerOrganism?: number
  evaluationBaseSeed?: string
  maxTicks: number
  dtMs: number
  threadCount?: number
  scenarioMode?: boolean
  scenariosPerOrganism?: number
  scenarioMaxTicks?: number
  fitnessWeights?: {
    rocksDestroyed: number
    accuracy: number
    survival: number
  }
  gateConfig?: Partial<{
    floor: number
    actionLow: number
    actionHigh: number
    actionSteepness: number
    turnFloor: number
    turnLow: number
    turnHigh: number
    turnSteepness: number
  }>
  scenarioWeight?: number
  scenarioSeedsPerOrganism?: number
  fullGameSeedsPerOrganism?: number
}

export interface ObserveTrainingAdapter {
  start(config: ObserveTrainingConfig): Promise<void>
  stop(): Promise<void>
  onGenerationBest(cb: (evt: ObserveGenerationBestEvent) => void): () => void
  onStatus(cb: (evt: ObserveTrainingStatusEvent) => void): () => void
}

const DEFAULT_OBSERVE_METHOD: SupportedAlgorithm = 'HyperNEAT'

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

interface BrowserWorkerEnvironmentOptions {
  encodingPreset?: EncodingPreset
  simulation?: Partial<HexagonoidsEnvironmentConfig['simulation']>
  fitnessWeights?: Partial<HexagonoidsEnvironmentConfig['fitnessWeights']>
  gateConfig?: Partial<HexagonoidsEnvironmentConfig['gateConfig']>
  scenarioBank?: HexagonoidsEnvironmentConfig['scenarioBank']
  scenarioWeight?: number
  scenarioSeedsPerOrganism?: number
  fullGameSeedsPerOrganism?: number
}

function createBrowserWorkerEnvironment(
  options: BrowserWorkerEnvironmentOptions
): Environment<HexagonoidsEnvironmentConfig> {
  const defaults = mergeConfig({})
  const config: HexagonoidsEnvironmentConfig = {
    ...defaults,
    encodingPreset: options.encodingPreset ?? defaults.encodingPreset,
    ...options,
    simulation: {
      ...defaults.simulation,
      ...options.simulation,
    },
    fitnessWeights: {
      ...defaults.fitnessWeights,
      ...options.fitnessWeights,
    },
    gateConfig: {
      ...defaults.gateConfig,
      ...options.gateConfig,
    },
    scenarioWeight: options.scenarioWeight ?? defaults.scenarioWeight,
    scenarioSeedsPerOrganism:
      options.scenarioSeedsPerOrganism ?? defaults.scenarioSeedsPerOrganism,
    fullGameSeedsPerOrganism:
      options.fullGameSeedsPerOrganism ?? defaults.fullGameSeedsPerOrganism,
  }
  const description: EnvironmentDescription = {
    inputs: getInputCountForEncoding(config.encodingPreset),
    outputs: 4,
  }

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
      return {
        encodingPreset: config.encodingPreset,
        simulation: { ...config.simulation },
        fitnessWeights: { ...config.fitnessWeights },
        gateConfig: { ...config.gateConfig },
        scenarioWeight: config.scenarioWeight,
        scenarioSeedsPerOrganism: config.scenarioSeedsPerOrganism,
        fullGameSeedsPerOrganism: config.fullGameSeedsPerOrganism,
        ...(config.scenarioBank != null && {
          scenarioBank: config.scenarioBank,
        }),
      }
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
      const threadCount = normalizeThreadCount(config.threadCount)
      const evaluationSeedsPerOrganism = normalizeEvaluationSeedsPerOrganism(
        config.evaluationSeedsPerOrganism
      )
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
          const mod = await import(
            '@heygrady/hexagonoids-demo/data/scenarios.json'
          )
          scenarioBank = decodeScenarioBankDocument(mod.default ?? mod)
          console.log(`[OBSERVE] Loaded ${scenarioBank.length} scenarios`)
        } catch (error) {
          console.warn(
            '[OBSERVE] Failed to load scenarios, falling back to full-game evaluation',
            error
          )
        }
      }

      const environment = createBrowserWorkerEnvironment({
        simulation: {
          maxTicks: config.maxTicks,
          dtMs: config.dtMs,
          useFastThrust: true,
          scenariosPerOrganism: config.scenariosPerOrganism ?? 20,
          scenarioMaxTicks: config.scenarioMaxTicks ?? 120,
        },
        ...(scenarioBank != null && { scenarioBank }),
        ...(config.fitnessWeights != null && {
          fitnessWeights: config.fitnessWeights,
        }),
        ...(config.gateConfig != null && { gateConfig: config.gateConfig }),
        ...(config.scenarioWeight != null && {
          scenarioWeight: config.scenarioWeight,
        }),
        ...(config.scenarioSeedsPerOrganism != null && {
          scenarioSeedsPerOrganism: config.scenarioSeedsPerOrganism,
        }),
        ...(config.fullGameSeedsPerOrganism != null && {
          fullGameSeedsPerOrganism: config.fullGameSeedsPerOrganism,
        }),
      })

      const evaluatorOptions: WorkerEvaluatorOptions = {
        algorithmPathname,
        createEnvironmentPathname,
        createExecutorPathname,
        taskCount: config.populationSize,
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
        populationSize: config.populationSize,
      })

      runPromise = evolve(population, {
        ...defaultEvolutionOptions,
        iterations: config.maxGenerations,
        threadCount,
        signal: abortController.signal,
        afterEvaluateInterval: 1,
        afterEvaluate: (activePopulation, iteration) => {
          if (disposed) return
          const generation = iteration + 1
          const best = activePopulation.best()
          generationTarget = Math.min(config.maxGenerations, generation + 1)
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
          generationTarget = config.maxGenerations
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
  if (
    organism == null ||
    typeof organism !== 'object' ||
    !('genome' in organism)
  ) {
    throw new Error('Observe training: organism is missing genome data')
  }
  const genome = (organism as { genome: unknown }).genome
  return createExecutor(createPhenotypeForGenome(method, genome) as never)
}
