import { defaultNEATConfigOptions } from '@neat-evolution/core'
import type {
  Environment,
  EnvironmentDescription,
} from '@neat-evolution/environment'
import {
  defaultEvolutionOptions,
  defaultPopulationOptions,
  evolve,
} from '@neat-evolution/evolution'
import type { Executor, SyncExecutor } from '@neat-evolution/executor'
import { createExecutor } from '@neat-evolution/executor'
import {
  createPopulation as createNEATPopulation,
  createPhenotype,
  defaultNEATGenomeOptions,
  NEATAlgorithm,
  type NEATGenome,
  type NEATPopulation,
} from '@neat-evolution/neat'
import type { WorkerEvaluatorOptions } from '@neat-evolution/worker-evaluator'
import { WorkerEvaluator } from '@neat-evolution/worker-evaluator'
// eslint-disable-next-line import/default
import workerEvaluatorScriptUrl from '@neat-evolution/worker-evaluator/workerEvaluatorScript?worker&url'
import {
  createReproducerFactory,
  type Terminable,
} from '@neat-evolution/worker-reproducer'
// eslint-disable-next-line import/default
import workerReproducerScriptUrl from '@neat-evolution/worker-reproducer/workerReproducerScript?worker&url'
import { hardwareConcurrency } from '@neat-evolution/worker-threads'

import { INPUT_COUNT } from '../../../../../../../packages/hexagonoids-environment/src/encoding/encodeGameState'

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
  maxGenerations: number
  populationSize: number
  maxTicks: number
  dtMs: number
  threadCount?: number
}

interface WorkerEnvironmentOptions {
  simulation: {
    maxTicks: number
    dtMs: number
    useFastThrust: boolean
  }
  profiling: {
    enabled: boolean
  }
}

export interface ObserveTrainingAdapter {
  start(config: ObserveTrainingConfig): Promise<void>
  stop(): Promise<void>
  onGenerationBest(cb: (evt: ObserveGenerationBestEvent) => void): () => void
  onStatus(cb: (evt: ObserveTrainingStatusEvent) => void): () => void
}

const modules = import.meta.glob('./modules/*.ts')

const extractModulePath = (
  key: string,
  importFn: () => Promise<unknown>
): string => {
  const fnString = importFn.toString()
  const importMatch = fnString.match(/import\(["']([^"']+)["']\)/)
  if (importMatch != null) {
    return new URL(importMatch[1], import.meta.url).href
  }
  return new URL(key, import.meta.url).href
}

function resolveWorkerModulePathnames() {
  let algorithmPathname = ''
  let createEnvironmentPathname = ''
  let createExecutorPathname = ''

  for (const [key, importFn] of Object.entries(modules)) {
    if (key.includes('NEATAlgorithmPathname')) {
      algorithmPathname = extractModulePath(key, importFn)
    } else if (key.includes('createEnvironmentPathname')) {
      createEnvironmentPathname = extractModulePath(key, importFn)
    } else if (key.includes('createExecutorPathname')) {
      createExecutorPathname = extractModulePath(key, importFn)
    }
  }

  if (algorithmPathname.length === 0) {
    throw new Error('Observe training: missing NEAT algorithm pathname')
  }
  if (createEnvironmentPathname.length === 0) {
    throw new Error('Observe training: missing createEnvironment pathname')
  }
  if (createExecutorPathname.length === 0) {
    throw new Error('Observe training: missing createExecutor pathname')
  }

  return {
    algorithmPathname,
    createEnvironmentPathname,
    createExecutorPathname,
  }
}

function normalizeThreadCount(value: number | undefined): number {
  if (value != null) return Math.max(1, Math.floor(value))
  return Math.max(1, Math.floor(hardwareConcurrency - 3))
}

function createBrowserWorkerEnvironment(
  options: WorkerEnvironmentOptions
): Environment<WorkerEnvironmentOptions> {
  const description: EnvironmentDescription = {
    inputs: INPUT_COUNT,
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
    toFactoryOptions(): WorkerEnvironmentOptions {
      return {
        simulation: { ...options.simulation },
        profiling: { ...options.profiling },
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

      const threadCount = normalizeThreadCount(config.threadCount)
      const {
        algorithmPathname,
        createEnvironmentPathname,
        createExecutorPathname,
      } = resolveWorkerModulePathnames()

      abortController = new AbortController()
      statusIntervalId = window.setInterval(() => {
        if (disposed) return
        emitStatus('training')
      }, 250)

      const environment = createBrowserWorkerEnvironment({
        simulation: {
          maxTicks: config.maxTicks,
          dtMs: config.dtMs,
          useFastThrust: true,
        },
        profiling: {
          enabled: false,
        },
      })

      const evaluatorOptions: WorkerEvaluatorOptions = {
        algorithmPathname,
        createEnvironmentPathname,
        createExecutorPathname,
        taskCount: config.populationSize,
        threadCount,
        workerScriptUrl: workerEvaluatorScriptUrl,
      }
      const evaluator = new WorkerEvaluator(
        NEATAlgorithm,
        environment,
        evaluatorOptions
      )
      terminables.add(evaluator)

      const createReproducer = createReproducerFactory<NEATGenome>(
        {
          algorithmPathname,
          threadCount,
          workerScriptUrl: workerReproducerScriptUrl,
        },
        terminables
      )

      const population = createNEATPopulation(
        createReproducer,
        evaluator,
        defaultNEATConfigOptions,
        {
          ...defaultPopulationOptions,
          populationSize: config.populationSize,
        },
        { ...defaultNEATGenomeOptions }
      ) as NEATPopulation

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

export function organismToExecutor(organism: unknown) {
  if (
    organism == null ||
    typeof organism !== 'object' ||
    !('genome' in organism)
  ) {
    throw new Error('Observe training: organism is missing genome data')
  }
  const genome = (organism as { genome: unknown }).genome
  return createExecutor(createPhenotype(genome as never) as never)
}
