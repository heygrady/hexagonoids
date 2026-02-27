import type {
  Environment,
  EnvironmentDescription,
} from '@neat-evolution/environment'
import type { Executor, SyncExecutor } from '@neat-evolution/executor'
import type { RNG } from '@neat-evolution/utils'

import { neatAgent } from './agents/neatAgent.js'
import { INPUT_COUNT } from './encoding/encodeGameState.js'
import { weightedFitnessSum } from './evaluation/calculateFitness.js'
import type { SimulationProfiler } from './evaluation/perfProfiler.js'
import { createSimulationProfiler } from './evaluation/perfProfiler.js'
import { simulateGame } from './evaluation/simulateGame.js'
import type { HexagonoidsEnvironmentConfig } from './HexagonoidsEnvironmentConfig.js'
import { mergeConfig } from './HexagonoidsEnvironmentConfig.js'

const OUTPUT_COUNT = 4

export class HexagonoidsEnvironment
  implements Environment<HexagonoidsEnvironmentConfig>
{
  public readonly description: EnvironmentDescription = {
    inputs: INPUT_COUNT,
    outputs: OUTPUT_COUNT,
  }
  public readonly isAsync = false
  private readonly config: HexagonoidsEnvironmentConfig
  private readonly profiler: SimulationProfiler | undefined

  constructor(config?: Partial<HexagonoidsEnvironmentConfig>) {
    this.config = mergeConfig(config)
    this.profiler = createSimulationProfiler(this.config.profiling)
  }

  evaluate(executor: SyncExecutor, rng?: RNG): number {
    const seed = rng != null ? String(rng.gen()) : 'default-seed'
    const metrics = simulateGame(
      neatAgent,
      this.config.simulation,
      seed,
      executor,
      this.profiler
    )
    return weightedFitnessSum(
      metrics,
      this.config.fitnessWeights,
      this.config.simulation
    )
  }

  evaluateBatch(executors: SyncExecutor[], rng?: RNG): number[] {
    return executors.map((executor) => this.evaluate(executor, rng))
  }

  async evaluateAsync(_executor: Executor): Promise<number> {
    throw new Error(
      'evaluateAsync is not implemented for this synchronous environment.'
    )
  }

  async evaluateBatchAsync(_executors: Executor[]): Promise<number[]> {
    throw new Error(
      'evaluateBatchAsync is not implemented for this synchronous environment.'
    )
  }

  toFactoryOptions(): HexagonoidsEnvironmentConfig {
    return {
      simulation: { ...this.config.simulation },
      fitnessWeights: { ...this.config.fitnessWeights },
      profiling: { ...this.config.profiling },
    }
  }
}
