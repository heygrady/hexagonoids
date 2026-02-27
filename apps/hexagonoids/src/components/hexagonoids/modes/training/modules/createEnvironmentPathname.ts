import type {
  Environment,
  EnvironmentDescription,
  EnvironmentFactory,
} from '@neat-evolution/environment'
import type { Executor, SyncExecutor } from '@neat-evolution/executor'
import type { RNG } from '@neat-evolution/utils'
import { neatAgent } from '../../../../../../../../packages/hexagonoids-environment/src/agents/neatAgent'
import { INPUT_COUNT } from '../../../../../../../../packages/hexagonoids-environment/src/encoding/encodeGameState'
import { weightedFitnessSum } from '../../../../../../../../packages/hexagonoids-environment/src/evaluation/calculateFitness'
import { simulateGame } from '../../../../../../../../packages/hexagonoids-environment/src/evaluation/simulateGame'
import type { HexagonoidsEnvironmentConfig } from '../../../../../../../../packages/hexagonoids-environment/src/HexagonoidsEnvironmentConfig'
import { mergeConfig } from '../../../../../../../../packages/hexagonoids-environment/src/HexagonoidsEnvironmentConfig'

const OUTPUT_COUNT = 4

class BrowserHexagonoidsEnvironment
  implements Environment<HexagonoidsEnvironmentConfig>
{
  public readonly description: EnvironmentDescription = {
    inputs: INPUT_COUNT,
    outputs: OUTPUT_COUNT,
  }
  public readonly isAsync = false
  private readonly config: HexagonoidsEnvironmentConfig

  constructor(config?: Partial<HexagonoidsEnvironmentConfig>) {
    this.config = mergeConfig(config)
  }

  evaluate(executor: SyncExecutor, rng?: RNG): number {
    const seed = rng != null ? String(rng.gen()) : 'default-seed'
    const metrics = simulateGame(
      neatAgent,
      this.config.simulation,
      seed,
      executor
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

export const createEnvironment: EnvironmentFactory<
  Partial<HexagonoidsEnvironmentConfig> | undefined
> = (options) => {
  return new BrowserHexagonoidsEnvironment(options)
}
