import type {
  Environment,
  EnvironmentDescription,
} from '@neat-evolution/environment'
import type { Executor, SyncExecutor } from '@neat-evolution/executor'
import type { RNG } from '@neat-evolution/utils'
import { createRNG } from '@neat-evolution/utils'

import { createNeatAgent } from './agents/neatAgent.js'
import { runCurriculum } from './curriculum/runCurriculum.js'
import { INPUT_COUNT } from './encoding/encodingPresets.js'
import {
  type ActionFrames,
  applyBehavioralGates,
  type FitnessContext,
  weightedFitnessSum,
} from './evaluation/calculateFitness.js'
import { computePossibleDeaths } from './evaluation/scenarioContext.js'
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
      inputs: INPUT_COUNT,
      outputs: OUTPUT_COUNT,
    }
    this.agent = createNeatAgent()
  }

  evaluate(executor: SyncExecutor, rng?: RNG): number {
    const seed = rng != null ? String(rng.gen()) : 'default-seed'

    const bank = this.config.scenarioBank
    const hasBank = bank != null && bank.length > 0
    const hasCurriculum = this.config.simulation.curriculumEnabled

    // Determine active weights — zero out unavailable evaluation modes
    let sw = hasBank ? this.config.scenarioWeight : 0
    let fw = this.config.fullGameWeight
    let cw = hasCurriculum ? this.config.curriculumWeight : 0

    // Accumulate frame counts across all episodes for aggregated behavioral gates
    const frames: ActionFrames = {
      thrustFrames: 0,
      fireFrames: 0,
      leftFrames: 0,
      rightFrames: 0,
      aliveFrames: 0,
    }

    // If all weights are zero, fall back to full games
    const total = sw + fw + cw
    if (total <= 0) {
      const fitness = this.evaluateFullGameMultiSeed(executor, seed, frames)
      return applyBehavioralGates(fitness, frames, this.config.gateConfig)
    }

    // Normalize weights
    sw /= total
    fw /= total
    cw /= total

    let fitness = 0

    if (sw > 0 && hasBank) {
      fitness +=
        sw * this.evaluateScenariosMultiSeed(bank, executor, seed, frames)
    }
    if (fw > 0) {
      fitness += fw * this.evaluateFullGameMultiSeed(executor, seed, frames)
    }
    if (cw > 0) {
      fitness += cw * this.evaluateCurriculum(executor, seed, frames)
    }

    // Apply behavioral gates on aggregated frame counts
    return applyBehavioralGates(fitness, frames, this.config.gateConfig)
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

  /**
   * Score curriculum micro-scenarios with weightedFitnessSum, then average.
   *
   * Each curriculum scenario produces full RawMetrics, which gets scored
   * the same way as regular scenarios — providing rich gradient signal
   * for accuracy, action diversity, turning, and rock destruction.
   */
  private evaluateCurriculum(
    executor: SyncExecutor,
    seed: string,
    frames: ActionFrames
  ): number {
    const { curriculumCount } = this.config.simulation
    const dtMs = this.config.simulation.dtMs

    const metricsArray = runCurriculum(
      this.agent,
      seed,
      dtMs,
      curriculumCount,
      executor
    )

    if (metricsArray.length === 0) return 0

    let fitnessSum = 0
    for (const metrics of metricsArray) {
      frames.thrustFrames += metrics.thrustFrames
      frames.fireFrames += metrics.fireFrames
      frames.leftFrames += metrics.leftFrames
      frames.rightFrames += metrics.rightFrames
      frames.aliveFrames += metrics.aliveFrames

      const context: FitnessContext = {
        possibleDeaths: computePossibleDeaths(metrics.elapsedTicks, dtMs),
        dtMs,
      }
      fitnessSum += weightedFitnessSum(
        metrics,
        this.config.fitnessWeights,
        this.config.gateConfig,
        context
      )
    }

    return fitnessSum / metricsArray.length
  }

  private evaluateScenariosMultiSeed(
    bank: ScenarioSnapshot[],
    executor: SyncExecutor,
    seed: string,
    frames: ActionFrames
  ): number {
    const count = this.config.scenarioSeedsPerOrganism
    if (count <= 1) {
      return this.evaluateScenarios(bank, executor, seed, frames)
    }
    let sum = 0
    for (let i = 0; i < count; i++) {
      sum += this.evaluateScenarios(
        bank,
        executor,
        `${seed}:scenario:${i}`,
        frames
      )
    }
    return sum / count
  }

  private evaluateFullGameMultiSeed(
    executor: SyncExecutor,
    seed: string,
    frames: ActionFrames
  ): number {
    const count = this.config.fullGameSeedsPerOrganism
    if (count <= 1) {
      return this.evaluateFullGame(executor, seed, frames)
    }
    let sum = 0
    for (let i = 0; i < count; i++) {
      sum += this.evaluateFullGame(executor, `${seed}:fullgame:${i}`, frames)
    }
    return sum / count
  }

  private evaluateFullGame(
    executor: SyncExecutor,
    seed: string,
    frames: ActionFrames
  ): number {
    const metrics = simulateGame(
      this.agent,
      this.config.simulation,
      seed,
      executor
    )

    frames.thrustFrames += metrics.thrustFrames
    frames.fireFrames += metrics.fireFrames
    frames.leftFrames += metrics.leftFrames
    frames.rightFrames += metrics.rightFrames
    frames.aliveFrames += metrics.aliveFrames

    const context: FitnessContext = {
      possibleDeaths: computePossibleDeaths(
        metrics.elapsedTicks,
        this.config.simulation.dtMs
      ),
      dtMs: this.config.simulation.dtMs,
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
    seed: string,
    frames: ActionFrames
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

      frames.thrustFrames += metrics.thrustFrames
      frames.fireFrames += metrics.fireFrames
      frames.leftFrames += metrics.leftFrames
      frames.rightFrames += metrics.rightFrames
      frames.aliveFrames += metrics.aliveFrames

      const context: FitnessContext = {
        possibleDeaths: computePossibleDeaths(
          metrics.elapsedTicks,
          this.config.simulation.dtMs
        ),
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
      simulation: { ...this.config.simulation },
      fitnessWeights: { ...this.config.fitnessWeights },
      gateConfig: { ...this.config.gateConfig },
      ...(this.config.scenarioBank != null && {
        scenarioBank: this.config.scenarioBank,
      }),
      scenarioWeight: this.config.scenarioWeight,
      fullGameWeight: this.config.fullGameWeight,
      curriculumWeight: this.config.curriculumWeight,
      scenarioSeedsPerOrganism: this.config.scenarioSeedsPerOrganism,
      fullGameSeedsPerOrganism: this.config.fullGameSeedsPerOrganism,
    }
  }
}
