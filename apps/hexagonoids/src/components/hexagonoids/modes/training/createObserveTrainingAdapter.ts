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

      const manager = new EvolutionManager({
        ...algorithmConfig(method),
        environment: {
          config: {
            description,
            toFactoryOptions: () => envConfig,
          },
          pathname: workerConfig.createEnvironmentPathname,
        },
        evolution: {
          iterations,
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
        },
        population: {
          options: { populationSize },
        },
        evaluation: {
          options: workerConfig.evaluatorConfig,
        },
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
