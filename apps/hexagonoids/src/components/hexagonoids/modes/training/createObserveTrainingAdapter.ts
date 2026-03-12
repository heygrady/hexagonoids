import {
  buildEnvironmentOptions,
  createHexagonoidsCPPNGenomeOptions,
  createHexagonoidsDESHyperNEATGenomeOptions,
  createHexagonoidsESHyperNEATGenomeOptions,
  createHexagonoidsHyperNEATGenomeOptions,
  createHexagonoidsNEATConfigOptions,
  createHexagonoidsNEATGenomeOptions,
  createPhenotypeForGenome,
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
import { CPPNAlgorithm } from '@neat-evolution/cppn'
import {
  DESHyperNEATAlgorithm,
  defaultTopologyConfigOptions,
} from '@neat-evolution/des-hyperneat'
import type { EnvironmentDescription } from '@neat-evolution/environment'
import { ESHyperNEATAlgorithm } from '@neat-evolution/es-hyperneat'
import type { AnyErasedGenome } from '@neat-evolution/evaluator'
import {
  EvolutionManager,
  type EvolutionManagerConfig,
} from '@neat-evolution/evolution-manager'
import { createExecutor } from '@neat-evolution/executor'
import { HyperNEATAlgorithm } from '@neat-evolution/hyperneat'
import { NEATAlgorithm } from '@neat-evolution/neat'
// eslint-disable-next-line import/default
import workerEvaluatorScriptUrl from '@neat-evolution/worker-evaluator/workerEvaluatorScript?worker&url'
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

      const manager = new EvolutionManager({
        ...algorithmConfig(method),
        environment: {
          description,
          toFactoryOptions: () => envConfig,
        },
        strategy: new MultiSeedGenerationStrategy(
          evaluationSeedsPerOrganism,
          config.evaluationBaseSeed ?? 'observe-training'
        ),
        evolutionOptions: {
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
        populationOptions: { populationSize },
        workerConfig: {
          createEnvironmentPathname,
          algorithmPathname,
          createExecutorPathname,
          threadCount,
          evaluatorWorkerScriptUrl: workerEvaluatorScriptUrl,
          reproducerWorkerScriptUrl: workerReproducerScriptUrl,
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
