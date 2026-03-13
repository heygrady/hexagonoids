import type {
  AgentEnvironment,
  Environment,
  EnvironmentDescription,
  EpisodicAgent,
  EpisodicEnvironment,
  RLConfig,
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
import {
  createRLEpisodeBridge,
  type EpisodeAgentBridge,
} from './evaluation/EpisodeAgentBridge.js'
import type { RawMetrics } from './evaluation/RawMetrics.js'
import { computePossibleDeaths } from './evaluation/scenarioContext.js'
import {
  DEFAULT_REWARD_CONFIG,
  type SimulationEpisodeRuntime,
  simulateGame,
} from './evaluation/simulateGame.js'
import type { HexagonoidsEnvironmentConfig } from './HexagonoidsEnvironmentConfig.js'
import { mergeConfig } from './HexagonoidsEnvironmentConfig.js'
import { simulateScenario } from './scenarios/simulateScenario.js'
import {
  buildStratifiedIndex,
  type StratifiedIndex,
  stratifiedSample,
} from './scenarios/stratifiedSample.js'
import type { ScenarioSnapshot } from './scenarios/types.js'

const OUTPUT_COUNT = 4

export class HexagonoidsEnvironment
  implements
    Environment<HexagonoidsEnvironmentConfig>,
    EpisodicEnvironment,
    AgentEnvironment
{
  public readonly description: EnvironmentDescription
  public readonly isAsync = false
  private readonly config: HexagonoidsEnvironmentConfig
  private readonly agent: ReturnType<typeof createNeatAgent>
  private readonly scenarioIndex?: StratifiedIndex
  private agentSeedCounter = 0

  constructor(config?: Partial<HexagonoidsEnvironmentConfig>) {
    this.config = mergeConfig(config)
    this.description = {
      inputs: INPUT_COUNT,
      outputs: OUTPUT_COUNT,
    }
    this.agent = createNeatAgent()
    if (
      this.config.scenarioBank != null &&
      this.config.scenarioBank.length > 0
    ) {
      this.scenarioIndex = buildStratifiedIndex(this.config.scenarioBank)
    }
  }

  evaluate(executor: SyncExecutor, rng?: RNG): number {
    const seed = rng != null ? String(rng.gen()) : 'default-seed'
    return this.evaluateGauntlet({ seed, executor })
  }

  getRLConfig(): RLConfig {
    return {
      actionSize: OUTPUT_COUNT,
      discountFactor: 0.99,
      maxStepsPerEpisode: this.config.simulation.maxTicks,
      suggestedRolloutLength: 32,
    }
  }

  evaluateAgent(agent: EpisodicAgent): number {
    const controller = createRLEpisodeBridge(agent)
    const seed = this.nextAgentSeed()
    return this.evaluateGauntlet({ seed, controller })
  }

  evaluateBatch(executors: SyncExecutor[], rng?: RNG): number[] {
    return executors.map((executor) => this.evaluate(executor, rng))
  }

  private evaluateGauntlet({
    seed,
    executor,
    controller,
  }: {
    seed: string
    executor?: SyncExecutor
    controller?: EpisodeAgentBridge
  }): number {
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

    const nextEpisodeIndex = (() => {
      let index = 0
      return () => {
        const current = index
        index += 1
        return current
      }
    })()

    // If all weights are zero, fall back to full games
    const total = sw + fw + cw
    if (total <= 0) {
      const fitness = this.evaluateFullGameMultiSeed(
        executor,
        seed,
        frames,
        controller,
        nextEpisodeIndex
      )
      return applyBehavioralGates(fitness, frames, this.config.gateConfig)
    }

    // Normalize weights
    sw /= total
    fw /= total
    cw /= total

    let fitness = 0

    if (sw > 0 && hasBank && bank != null) {
      fitness +=
        sw *
        this.evaluateScenariosMultiSeed(
          bank,
          executor,
          seed,
          frames,
          controller,
          nextEpisodeIndex
        )
    }
    if (fw > 0) {
      fitness +=
        fw *
        this.evaluateFullGameMultiSeed(
          executor,
          seed,
          frames,
          controller,
          nextEpisodeIndex
        )
    }
    if (cw > 0) {
      fitness +=
        cw *
        this.evaluateCurriculum(
          executor,
          seed,
          frames,
          controller,
          nextEpisodeIndex
        )
    }

    // Apply behavioral gates on aggregated frame counts
    return applyBehavioralGates(fitness, frames, this.config.gateConfig)
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
    executor: SyncExecutor | undefined,
    seed: string,
    frames: ActionFrames,
    controller: EpisodeAgentBridge | undefined,
    nextEpisodeIndex: () => number
  ): number {
    const { curriculumCount } = this.config.simulation
    const dtMs = this.config.simulation.dtMs

    const episodeFitnessValues: number[] = []
    const runtimeFactory = controller
      ? (index: number): SimulationEpisodeRuntime => ({
          controller,
          episodeInfo: {
            episodeIndex: nextEpisodeIndex(),
            type: 'curriculum',
            metadata: { index, seed: `${seed}:curriculum:${index}` },
          },
          metadata: { index, seed: `${seed}:curriculum:${index}` },
          rewardConfig: DEFAULT_REWARD_CONFIG,
          onEpisodeComplete: (metrics) => {
            const fitness = this.scoreMetrics(metrics)
            episodeFitnessValues[index] = fitness
            return fitness
          },
        })
      : undefined

    const metricsArray = runCurriculum(
      controller?.agent ?? this.agent,
      seed,
      dtMs,
      curriculumCount,
      controller ? undefined : executor,
      runtimeFactory
    )

    if (metricsArray.length === 0) return 0

    let fitnessSum = 0
    metricsArray.forEach((metrics, index) => {
      frames.thrustFrames += metrics.thrustFrames
      frames.fireFrames += metrics.fireFrames
      frames.leftFrames += metrics.leftFrames
      frames.rightFrames += metrics.rightFrames
      frames.aliveFrames += metrics.aliveFrames

      const fitness =
        controller && episodeFitnessValues[index] !== undefined
          ? episodeFitnessValues[index]!
          : this.scoreMetrics(metrics)
      fitnessSum += fitness
    })

    return fitnessSum / metricsArray.length
  }

  private evaluateScenariosMultiSeed(
    bank: ScenarioSnapshot[],
    executor: SyncExecutor | undefined,
    seed: string,
    frames: ActionFrames,
    controller: EpisodeAgentBridge | undefined,
    nextEpisodeIndex: () => number
  ): number {
    const count = this.config.scenarioSeedsPerOrganism
    if (count <= 1) {
      return this.evaluateScenarios(
        bank,
        executor,
        seed,
        frames,
        controller,
        nextEpisodeIndex
      )
    }
    let sum = 0
    for (let i = 0; i < count; i++) {
      sum += this.evaluateScenarios(
        bank,
        executor,
        `${seed}:scenario:${i}`,
        frames,
        controller,
        nextEpisodeIndex
      )
    }
    return sum / count
  }

  private evaluateFullGameMultiSeed(
    executor: SyncExecutor | undefined,
    seed: string,
    frames: ActionFrames,
    controller: EpisodeAgentBridge | undefined,
    nextEpisodeIndex: () => number
  ): number {
    const count = this.config.fullGameSeedsPerOrganism
    if (count <= 1) {
      return this.evaluateFullGame(
        executor,
        seed,
        frames,
        controller,
        nextEpisodeIndex
      )
    }
    let sum = 0
    for (let i = 0; i < count; i++) {
      sum += this.evaluateFullGame(
        executor,
        `${seed}:fullgame:${i}`,
        frames,
        controller,
        nextEpisodeIndex
      )
    }
    return sum / count
  }

  private evaluateFullGame(
    executor: SyncExecutor | undefined,
    seed: string,
    frames: ActionFrames,
    controller: EpisodeAgentBridge | undefined,
    nextEpisodeIndex: () => number
  ): number {
    let episodeFitness = 0
    const runtimeOptions: SimulationEpisodeRuntime | undefined = controller
      ? {
          controller,
          episodeInfo: {
            episodeIndex: nextEpisodeIndex(),
            type: 'full-game',
            metadata: { seed },
          },
          metadata: { seed },
          rewardConfig: DEFAULT_REWARD_CONFIG,
          onEpisodeComplete: (metrics) => {
            episodeFitness = this.scoreMetrics(metrics)
            return episodeFitness
          },
        }
      : undefined

    const metrics = simulateGame(
      controller?.agent ?? this.agent,
      this.config.simulation,
      seed,
      controller ? undefined : executor,
      runtimeOptions
    )
    if (!controller) {
      episodeFitness = this.scoreMetrics(metrics)
    }

    frames.thrustFrames += metrics.thrustFrames
    frames.fireFrames += metrics.fireFrames
    frames.leftFrames += metrics.leftFrames
    frames.rightFrames += metrics.rightFrames
    frames.aliveFrames += metrics.aliveFrames

    return episodeFitness
  }

  private evaluateScenarios(
    bank: ScenarioSnapshot[],
    executor: SyncExecutor | undefined,
    seed: string,
    frames: ActionFrames,
    controller: EpisodeAgentBridge | undefined,
    nextEpisodeIndex: () => number
  ): number {
    const { scenariosPerOrganism, scenarioMaxTicks } = this.config.simulation

    // Select scenarios using multi-dimensional stratified sampling
    const selectionRng = createRNG(seed)
    const count = Math.min(scenariosPerOrganism, bank.length)
    const selected = stratifiedSample(
      this.scenarioIndex ?? bank,
      count,
      selectionRng
    )

    // Score each scenario individually, then average
    const scenarioConfig = {
      ...this.config.simulation,
      maxTicks: scenarioMaxTicks,
    }
    let fitnessSum = 0
    for (const scenario of selected) {
      let episodeFitness = 0
      const scenarioSeed = `${seed}:${scenario.id}`
      const runtimeOptions: SimulationEpisodeRuntime | undefined = controller
        ? {
            controller,
            episodeInfo: {
              episodeIndex: nextEpisodeIndex(),
              type: 'scenario',
              metadata: { id: scenario.id, seed: scenarioSeed },
            },
            situationClass: scenario.necklace ?? undefined,
            metadata: { id: scenario.id, seed: scenarioSeed },
            rewardConfig: DEFAULT_REWARD_CONFIG,
            onEpisodeComplete: (metrics) => {
              episodeFitness = this.scoreMetrics(metrics)
              return episodeFitness
            },
          }
        : undefined
      const metrics = simulateScenario(
        controller?.agent ?? this.agent,
        scenario,
        scenarioConfig,
        scenarioSeed,
        controller ? undefined : executor,
        runtimeOptions
      )
      if (!controller) {
        episodeFitness = this.scoreMetrics(metrics)
      }

      frames.thrustFrames += metrics.thrustFrames
      frames.fireFrames += metrics.fireFrames
      frames.leftFrames += metrics.leftFrames
      frames.rightFrames += metrics.rightFrames
      frames.aliveFrames += metrics.aliveFrames

      fitnessSum += episodeFitness
    }

    return fitnessSum / selected.length
  }

  private scoreMetrics(metrics: RawMetrics): number {
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

  private nextAgentSeed(): string {
    const seed = `agent-${this.agentSeedCounter}`
    this.agentSeedCounter += 1
    return seed
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
