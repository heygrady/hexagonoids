import {
  aggregateMetrics,
  type FitnessContext,
  type HexagonoidsEnvironmentConfig,
  INPUT_COUNT,
  mergeConfig,
  neatAgent,
  type RawMetrics,
  type ScenarioSnapshot,
  simulateGame,
  simulateScenario,
  weightedFitnessSum,
} from '@heygrady/hexagonoids-environment'
import type {
  Environment,
  EnvironmentDescription,
  EnvironmentFactory,
} from '@neat-evolution/environment'
import type { Executor, SyncExecutor } from '@neat-evolution/executor'
import type { RNG } from '@neat-evolution/utils'
import { createRNG } from '@neat-evolution/utils'

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

    const bank = this.config.scenarioBank
    if (bank != null && bank.length > 0) {
      return this.evaluateScenarios(bank, executor, seed)
    }

    const metrics = simulateGame(
      neatAgent,
      this.config.simulation,
      seed,
      executor
    )
    return weightedFitnessSum(
      metrics,
      this.config.fitnessWeights,
      this.config.simulation,
      this.config.gateConfig
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

  private evaluateScenarios(
    bank: ScenarioSnapshot[],
    executor: SyncExecutor,
    seed: string
  ): number {
    const { scenariosPerOrganism, scenarioMaxTicks } = this.config.simulation

    // Select scenarios using a seeded RNG for reproducibility
    const selectionRng = createRNG(seed)
    const selected: ScenarioSnapshot[] = []
    const count = Math.min(scenariosPerOrganism, bank.length)
    if (count >= bank.length) {
      selected.push(...bank)
    } else {
      // Fisher-Yates partial shuffle for uniform selection
      const indices = Array.from({ length: bank.length }, (_, i) => i)
      for (let i = 0; i < count; i++) {
        const j = i + Math.floor(selectionRng.gen() * (bank.length - i))
        const temp = indices[i]!
        indices[i] = indices[j]!
        indices[j] = temp
        selected.push(bank[indices[i]!]!)
      }
    }

    // Run each scenario and collect metrics
    const allMetrics: RawMetrics[] = []
    const scenarioConfig = {
      ...this.config.simulation,
      maxTicks: scenarioMaxTicks,
    }
    for (const scenario of selected) {
      const metrics = simulateScenario(
        neatAgent,
        scenario,
        scenarioConfig,
        seed,
        executor
      )
      allMetrics.push(metrics)
    }

    // Aggregate metrics across scenarios
    const aggregated = aggregateMetrics(allMetrics)

    // Compute possibleDeaths from selected scenarios' starting lives
    const possibleDeaths = selected.reduce(
      (sum, sc) => sum + sc.player.lives,
      0
    )

    const fitnessSimConfig = {
      ...this.config.simulation,
      maxTicks: scenariosPerOrganism * scenarioMaxTicks,
    }

    const context: FitnessContext = { possibleDeaths }

    return weightedFitnessSum(
      aggregated,
      this.config.fitnessWeights,
      fitnessSimConfig,
      this.config.gateConfig,
      context
    )
  }

  toFactoryOptions(): HexagonoidsEnvironmentConfig {
    return {
      simulation: { ...this.config.simulation },
      fitnessWeights: { ...this.config.fitnessWeights },
      gateConfig: { ...this.config.gateConfig },
      profiling: { ...this.config.profiling },
      ...(this.config.scenarioBank != null && {
        scenarioBank: this.config.scenarioBank,
      }),
    }
  }
}

export const createEnvironment: EnvironmentFactory<
  Partial<HexagonoidsEnvironmentConfig> | undefined
> = (options) => {
  return new BrowserHexagonoidsEnvironment(options)
}
