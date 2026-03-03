import type {
  Environment,
  EnvironmentDescription,
} from '@neat-evolution/environment'
import type { Executor, SyncExecutor } from '@neat-evolution/executor'
import type { RNG } from '@neat-evolution/utils'
import { createRNG } from '@neat-evolution/utils'

import { createNeatAgent } from './agents/neatAgent.js'
import { getInputCountForEncoding } from './encoding/encodingPresets.js'
import {
  type FitnessContext,
  weightedFitnessSum,
} from './evaluation/calculateFitness.js'
import {
  fullGameMaximums,
  scenarioMaximums,
  scenarioPossibleDeaths,
} from './evaluation/scenarioContext.js'
import { simulateGame } from './evaluation/simulateGame.js'
import type { HexagonoidsEnvironmentConfig } from './HexagonoidsEnvironmentConfig.js'
import { mergeConfig } from './HexagonoidsEnvironmentConfig.js'
import { simulateScenario } from './scenarios/simulateScenario.js'
import { stratifiedSample } from './scenarios/stratifiedSample.js'
import type { ScenarioSnapshot } from './scenarios/types.js'

const OUTPUT_COUNT = 4

export class HexagonoidsEnvironment
  implements Environment<HexagonoidsEnvironmentConfig>
{
  public readonly description: EnvironmentDescription
  public readonly isAsync = false
  private readonly config: HexagonoidsEnvironmentConfig
  private readonly agent: ReturnType<typeof createNeatAgent>

  constructor(config?: Partial<HexagonoidsEnvironmentConfig>) {
    this.config = mergeConfig(config)
    this.description = {
      inputs: getInputCountForEncoding(this.config.encodingPreset),
      outputs: OUTPUT_COUNT,
    }
    this.agent = createNeatAgent(this.config.encodingPreset)
  }

  evaluate(executor: SyncExecutor, rng?: RNG): number {
    const seed = rng != null ? String(rng.gen()) : 'default-seed'

    const bank = this.config.scenarioBank
    if (bank != null && bank.length > 0) {
      const w = this.config.scenarioWeight
      if (w >= 1.0) {
        return this.evaluateScenariosMultiSeed(bank, executor, seed)
      }
      if (w <= 0.0) {
        return this.evaluateFullGameMultiSeed(executor, seed)
      }
      const scenarioFitness = this.evaluateScenariosMultiSeed(
        bank,
        executor,
        seed
      )
      const fullGameFitness = this.evaluateFullGameMultiSeed(executor, seed)
      return w * scenarioFitness + (1 - w) * fullGameFitness
    }

    return this.evaluateFullGameMultiSeed(executor, seed)
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

  private evaluateScenariosMultiSeed(
    bank: ScenarioSnapshot[],
    executor: SyncExecutor,
    seed: string
  ): number {
    const count = this.config.scenarioSeedsPerOrganism
    if (count <= 1) {
      return this.evaluateScenarios(bank, executor, seed)
    }
    let sum = 0
    for (let i = 0; i < count; i++) {
      sum += this.evaluateScenarios(bank, executor, `${seed}:scenario:${i}`)
    }
    return sum / count
  }

  private evaluateFullGameMultiSeed(
    executor: SyncExecutor,
    seed: string
  ): number {
    const count = this.config.fullGameSeedsPerOrganism
    if (count <= 1) {
      return this.evaluateFullGame(executor, seed)
    }
    let sum = 0
    for (let i = 0; i < count; i++) {
      sum += this.evaluateFullGame(executor, `${seed}:fullgame:${i}`)
    }
    return sum / count
  }

  private evaluateFullGame(executor: SyncExecutor, seed: string): number {
    const metrics = simulateGame(
      this.agent,
      this.config.simulation,
      seed,
      executor
    )
    const context: FitnessContext = {
      ...fullGameMaximums(this.config.simulation.maxTicks),
    }
    return weightedFitnessSum(
      metrics,
      this.config.fitnessWeights,
      this.config.gateConfig,
      context
    )
  }

  private evaluateScenarios(
    bank: ScenarioSnapshot[],
    executor: SyncExecutor,
    seed: string
  ): number {
    const { scenariosPerOrganism, scenarioMaxTicks } = this.config.simulation

    // Select scenarios using stratified sampling by failure signature
    const selectionRng = createRNG(seed)
    const count = Math.min(scenariosPerOrganism, bank.length)
    const selected = stratifiedSample(bank, count, selectionRng)

    // Score each scenario individually, then average
    const scenarioConfig = {
      ...this.config.simulation,
      maxTicks: scenarioMaxTicks,
    }
    let fitnessSum = 0
    for (const scenario of selected) {
      const metrics = simulateScenario(
        this.agent,
        scenario,
        scenarioConfig,
        seed,
        executor
      )
      const context: FitnessContext = {
        possibleDeaths: scenarioPossibleDeaths(
          scenario.player.lives,
          scenarioMaxTicks,
          this.config.simulation.dtMs
        ),
        ...scenarioMaximums(scenarioMaxTicks),
      }
      fitnessSum += weightedFitnessSum(
        metrics,
        this.config.fitnessWeights,
        this.config.gateConfig,
        context
      )
    }

    return fitnessSum / selected.length
  }

  toFactoryOptions(): HexagonoidsEnvironmentConfig {
    return {
      encodingPreset: this.config.encodingPreset,
      simulation: { ...this.config.simulation },
      fitnessWeights: { ...this.config.fitnessWeights },
      gateConfig: { ...this.config.gateConfig },
      ...(this.config.scenarioBank != null && {
        scenarioBank: this.config.scenarioBank,
      }),
      scenarioWeight: this.config.scenarioWeight,
      scenarioSeedsPerOrganism: this.config.scenarioSeedsPerOrganism,
      fullGameSeedsPerOrganism: this.config.fullGameSeedsPerOrganism,
    }
  }
}
