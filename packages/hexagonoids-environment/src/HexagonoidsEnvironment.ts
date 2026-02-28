import type {
  Environment,
  EnvironmentDescription,
} from '@neat-evolution/environment'
import type { Executor, SyncExecutor } from '@neat-evolution/executor'
import type { RNG } from '@neat-evolution/utils'
import { createRNG } from '@neat-evolution/utils'

import { neatAgent } from './agents/neatAgent.js'
import { INPUT_COUNT } from './encoding/encodeGameState.js'
import { aggregateMetrics } from './evaluation/aggregateMetrics.js'
import {
  type FitnessContext,
  weightedFitnessSum,
} from './evaluation/calculateFitness.js'
import { createSimulationProfiler } from './evaluation/nodePerfProfiler.js'
import type { SimulationProfiler } from './evaluation/perfProfiler.js'
import type { RawMetrics } from './evaluation/RawMetrics.js'
import { simulateGame } from './evaluation/simulateGame.js'
import type { HexagonoidsEnvironmentConfig } from './HexagonoidsEnvironmentConfig.js'
import { mergeConfig } from './HexagonoidsEnvironmentConfig.js'
import { simulateScenario } from './scenarios/simulateScenario.js'
import type { ScenarioSnapshot } from './scenarios/types.js'

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

    const bank = this.config.scenarioBank
    if (bank != null && bank.length > 0) {
      return this.evaluateScenarios(bank, executor, seed)
    }

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
      // Use all scenarios
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
        executor,
        this.profiler
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
