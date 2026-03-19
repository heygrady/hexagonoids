import type {
  Environment,
  EnvironmentDescription,
} from '@neat-evolution/environment'
import type {
  EnvironmentInitOptions,
  PartialEvaluationContext,
} from '@neat-evolution/execution-manager'
import type { StaticExecutor } from '@neat-evolution/executor'
import {
  createVanillaStepAgent,
  type StepAgent,
  type StepAgentFactory,
  type StepAgentFactoryOptions,
} from '@neat-evolution/rl-core'
import type { StatsRecorder } from '@neat-evolution/stats'
import { createRNG } from '@neat-evolution/utils'

import { createGameAgent, type GameAgent } from './agents/createGameAgent.js'
import { runCurriculum } from './curriculum/runCurriculum.js'
import { INPUT_COUNT } from './encoding/encodingPresets.js'
import {
  type ActionFrames,
  applyBehavioralGates,
  computeFitnessBreakdown,
  computeGateBreakdown,
  type FitnessBreakdown,
  type FitnessContext,
  type GauntletBreakdown,
  weightedFitnessSum,
} from './evaluation/calculateFitness.js'
import {
  METRIC_EPISODE_FITNESS,
  METRIC_GAUNTLET_BREAKDOWN,
} from './evaluation/metrics.js'
import type { RawMetrics } from './evaluation/RawMetrics.js'
import { computePossibleDeaths } from './evaluation/scenarioContext.js'
import {
  DEFAULT_REWARD_CONFIG,
  type RewardConfig,
  type SimulationHooks,
  simulateGame,
  type TickDeltas,
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

const DEFAULT_OUTPUT_COUNT = 4
const PLAYER_ID = 'player-1'

function createNoopStepAgent(): StepAgent {
  return {
    act(): Float64Array {
      throw new Error('No-op step agent act() should not be called')
    },
    completeStep(): void {},
    startEpisode(): void {},
    endEpisode(): void {},
  }
}

export class HexagonoidsEnvironment
  implements Environment<HexagonoidsEnvironmentConfig>
{
  public readonly description: EnvironmentDescription
  public readonly isAsync = false
  private readonly config: HexagonoidsEnvironmentConfig
  private readonly scenarioIndex?: StratifiedIndex
  private readonly initOptions:
    | EnvironmentInitOptions<StepAgentFactory, StepAgentFactoryOptions>
    | undefined
  private agentSeedCounter = 0

  constructor(
    config?: Partial<HexagonoidsEnvironmentConfig>,
    initOptions?: EnvironmentInitOptions
  ) {
    this.config = mergeConfig(config)
    this.initOptions = initOptions as
      | EnvironmentInitOptions<StepAgentFactory, StepAgentFactoryOptions>
      | undefined
    const outputCount = this.config.outputCount ?? DEFAULT_OUTPUT_COUNT
    this.description = {
      inputs: INPUT_COUNT,
      outputs: outputCount,
    }
    if (
      this.config.scenarioBank != null &&
      this.config.scenarioBank.length > 0
    ) {
      this.scenarioIndex = buildStratifiedIndex(this.config.scenarioBank)
    }
  }

  evaluate(
    executor: StaticExecutor,
    context?: PartialEvaluationContext
  ): number {
    const createExecutionManager =
      this.initOptions?.createExecutionManager ?? createVanillaStepAgent
    const options = (this.initOptions?.executionManagerFactoryOptions ??
      {}) as StepAgentFactoryOptions
    const agent = createExecutionManager(executor, options, context)
    return this.evaluateStepAgent(agent, context)
  }

  evaluateStepAgent(
    agent: StepAgent,
    context?: PartialEvaluationContext
  ): number {
    const gameAgent = createGameAgent(agent)
    return this.evaluateControlledGameAgent(agent, gameAgent, context)
  }

  evaluateGameAgent(
    gameAgent: GameAgent,
    context?: PartialEvaluationContext,
    agent?: StepAgent
  ): number {
    return this.evaluateControlledGameAgent(
      agent ?? createNoopStepAgent(),
      gameAgent,
      context
    )
  }

  private evaluateControlledGameAgent(
    agent: StepAgent,
    gameAgent: GameAgent,
    context?: PartialEvaluationContext
  ): number {
    const stats = context?.stats
    const seed =
      context?.rng != null ? String(context.rng.gen()) : this.nextAgentSeed()
    return this.evaluateGauntlet({
      seed,
      agent,
      gameAgent,
      stats,
    })
  }

  evaluateBatch(
    executors: StaticExecutor[],
    context?: PartialEvaluationContext
  ): number[] {
    return executors.map((executor) => this.evaluate(executor, context))
  }

  private evaluateGauntlet({
    seed,
    agent,
    gameAgent,
    stats,
  }: {
    seed: string
    agent: StepAgent
    gameAgent: GameAgent
    stats?: StatsRecorder | undefined
  }): number {
    const bank = this.config.scenarioBank
    const hasBank = bank != null && bank.length > 0
    const hasCurriculum = this.config.simulation.curriculumEnabled

    // Check what stats are wanted (zero-cost when no recorder)
    const wantsBreakdown = stats?.wants(METRIC_GAUNTLET_BREAKDOWN) === true
    const wantsEpisode = stats?.wants(METRIC_EPISODE_FITNESS) === true
    const wantsStats = wantsBreakdown || wantsEpisode

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

    // Collect per-episode breakdowns when stats active
    const scenarioBreakdowns: FitnessBreakdown[] = []
    const fullGameBreakdowns: FitnessBreakdown[] = []
    const curriculumBreakdowns: FitnessBreakdown[] = []

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
        seed,
        frames,
        agent,
        gameAgent,
        nextEpisodeIndex,
        wantsStats ? fullGameBreakdowns : undefined,
        stats
      )
      const gatedFitness = applyBehavioralGates(
        fitness,
        frames,
        this.config.gateConfig
      )

      if (wantsBreakdown && stats != null) {
        const gates = computeGateBreakdown(frames, this.config.gateConfig)
        const breakdown: GauntletBreakdown = {
          fitness: gatedFitness,
          blendedFitnessRaw: fitness,
          scenarioFitness: 0,
          fullGameFitness: fitness,
          curriculumFitness: 0,
          gates,
          scenarioBreakdowns: [],
          fullGameBreakdowns,
          curriculumBreakdowns: [],
          aggregatedFrames: { ...frames },
        }
        stats.record(METRIC_GAUNTLET_BREAKDOWN, breakdown)
      }

      return gatedFitness
    }

    // Normalize weights
    sw /= total
    fw /= total
    cw /= total

    let scenarioFitness = 0
    let fullGameFitness = 0
    let curriculumFitness = 0

    if (sw > 0 && hasBank && bank != null) {
      scenarioFitness = this.evaluateScenariosMultiSeed(
        bank,
        seed,
        frames,
        agent,
        gameAgent,
        nextEpisodeIndex,
        wantsStats ? scenarioBreakdowns : undefined,
        stats
      )
    }
    if (fw > 0) {
      fullGameFitness = this.evaluateFullGameMultiSeed(
        seed,
        frames,
        agent,
        gameAgent,
        nextEpisodeIndex,
        wantsStats ? fullGameBreakdowns : undefined,
        stats
      )
    }
    if (cw > 0) {
      curriculumFitness = this.evaluateCurriculum(
        seed,
        frames,
        agent,
        gameAgent,
        nextEpisodeIndex,
        wantsStats ? curriculumBreakdowns : undefined,
        stats
      )
    }

    const blendedFitnessRaw =
      sw * scenarioFitness + fw * fullGameFitness + cw * curriculumFitness

    // Apply behavioral gates on aggregated frame counts
    const gatedFitness = applyBehavioralGates(
      blendedFitnessRaw,
      frames,
      this.config.gateConfig
    )

    if (wantsBreakdown && stats != null) {
      const gates = computeGateBreakdown(frames, this.config.gateConfig)
      const breakdown: GauntletBreakdown = {
        fitness: gatedFitness,
        blendedFitnessRaw,
        scenarioFitness,
        fullGameFitness,
        curriculumFitness,
        gates,
        scenarioBreakdowns,
        fullGameBreakdowns,
        curriculumBreakdowns,
        aggregatedFrames: { ...frames },
      }
      stats.record(METRIC_GAUNTLET_BREAKDOWN, breakdown)
    }

    return gatedFitness
  }

  async evaluateAsync(
    _executor: StaticExecutor,
    _context?: PartialEvaluationContext
  ): Promise<number> {
    throw new Error(
      'evaluateAsync is not implemented for this synchronous environment.'
    )
  }

  async evaluateBatchAsync(
    _executors: StaticExecutor[],
    _context?: PartialEvaluationContext
  ): Promise<number[]> {
    throw new Error(
      'evaluateBatchAsync is not implemented for this synchronous environment.'
    )
  }

  /**
   * Build a SimulationHooks closure that computes reward from TickDeltas and
   * finalizes the current step with the next observation.
   */
  private buildSimulationHooks(
    agent: StepAgent,
    gameAgent: GameAgent,
    rewardConfig?: Partial<RewardConfig>,
    situationClass?: number
  ): SimulationHooks {
    const resolvedRewardConfig: RewardConfig = {
      ...DEFAULT_REWARD_CONFIG,
      ...rewardConfig,
    }
    return {
      onAfterTick(deltas: TickDeltas, snapshot) {
        let reward = 0
        if (deltas.shipAlive) {
          reward += resolvedRewardConfig.survivalReward
        }
        if (deltas.rocksDestroyed > 0) {
          reward += resolvedRewardConfig.rockReward * deltas.rocksDestroyed
        }
        if (deltas.scoreDelta !== 0) {
          reward += deltas.scoreDelta * resolvedRewardConfig.scoreScale
        }
        if (deltas.lifeDelta < 0) {
          reward += resolvedRewardConfig.deathPenalty * Math.abs(deltas.lifeDelta)
        }
        if (deltas.newBullets > 0) {
          reward -= deltas.newBullets * resolvedRewardConfig.shotPenalty
        }
        if (deltas.waveChanged) {
          reward += resolvedRewardConfig.waveBonus
        }

        const transitionInfo: Record<string, unknown> = {}
        if (situationClass != null) {
          transitionInfo.situationClass = situationClass
        }
        if (deltas.rocksDestroyed > 0 || deltas.lifeDelta < 0) {
          transitionInfo.isInteresting = true
        }

        if (
          transitionInfo.isInteresting ||
          transitionInfo.situationClass != null
        ) {
          transitionInfo.tick = deltas.tick
        }

        const nextState = gameAgent.observe(
          snapshot.state,
          PLAYER_ID,
          snapshot.context
        )
        agent.completeStep({
          reward,
          nextState,
          terminated: deltas.terminated,
          truncated: deltas.truncated,
          ...(Object.keys(transitionInfo).length > 0
            ? { info: transitionInfo }
            : {}),
        })
      },
    }
  }

  /**
   * Score a single episode's metrics. When stats are active, returns the
   * full FitnessBreakdown; otherwise returns just the scalar fitness.
   */
  private scoreMetricsWithBreakdown(
    metrics: RawMetrics,
    breakdowns: FitnessBreakdown[] | undefined,
    stats: StatsRecorder | undefined
  ): number {
    const context: FitnessContext = {
      possibleDeaths: computePossibleDeaths(
        metrics.elapsedTicks,
        this.config.simulation.dtMs
      ),
      dtMs: this.config.simulation.dtMs,
    }

    if (breakdowns != null || stats?.wants(METRIC_EPISODE_FITNESS) === true) {
      const breakdown = computeFitnessBreakdown(
        metrics,
        this.config.fitnessWeights,
        this.config.gateConfig,
        context
      )
      if (breakdowns != null) {
        breakdowns.push(breakdown)
      }
      if (stats?.wants(METRIC_EPISODE_FITNESS) === true) {
        stats.record(METRIC_EPISODE_FITNESS, breakdown)
      }
      return breakdown.fitness
    }

    return weightedFitnessSum(
      metrics,
      this.config.fitnessWeights,
      this.config.gateConfig,
      context
    )
  }

  /**
   * Score curriculum micro-scenarios with weightedFitnessSum, then average.
   */
  private evaluateCurriculum(
    seed: string,
    frames: ActionFrames,
    agent: StepAgent,
    gameAgent: GameAgent,
    nextEpisodeIndex: () => number,
    breakdowns?: FitnessBreakdown[],
    stats?: StatsRecorder
  ): number {
    const { curriculumCount } = this.config.simulation
    const dtMs = this.config.simulation.dtMs

    const hooksFactory = (index: number): SimulationHooks => {
      const episodeIndex = nextEpisodeIndex()
      agent.startEpisode({
        episodeIndex,
        type: 'curriculum',
        metadata: { index, seed: `${seed}:curriculum:${index}` },
      })
      return this.buildSimulationHooks(agent, gameAgent, this.config.rewardConfig)
    }

    const metricsArray = runCurriculum(
      gameAgent.agent,
      seed,
      dtMs,
      curriculumCount,
      hooksFactory
    )

    if (metricsArray.length === 0) return 0

    let fitnessSum = 0
    for (const [index, metrics] of metricsArray.entries()) {
      frames.thrustFrames += metrics.thrustFrames
      frames.fireFrames += metrics.fireFrames
      frames.leftFrames += metrics.leftFrames
      frames.rightFrames += metrics.rightFrames
      frames.aliveFrames += metrics.aliveFrames

      const fitness = this.scoreMetricsWithBreakdown(metrics, breakdowns, stats)
      fitnessSum += fitness

      const terminated =
        metrics.livesRemaining <= 0 ||
        metrics.elapsedTicks < this.config.simulation.maxTicks
      agent.endEpisode({
        fitness,
        episodeReturn: 0,
        totalSteps: metrics.elapsedTicks,
        terminated,
        metadata: { index, seed: `${seed}:curriculum:${index}` },
      })
      gameAgent.resetMemory()
    }

    return fitnessSum / metricsArray.length
  }

  private evaluateScenariosMultiSeed(
    bank: ScenarioSnapshot[],
    seed: string,
    frames: ActionFrames,
    agent: StepAgent,
    gameAgent: GameAgent,
    nextEpisodeIndex: () => number,
    breakdowns?: FitnessBreakdown[],
    stats?: StatsRecorder
  ): number {
    const count = this.config.scenarioSeedsPerOrganism
    if (count <= 1) {
      return this.evaluateScenarios(
        bank,
        seed,
        frames,
        agent,
        gameAgent,
        nextEpisodeIndex,
        breakdowns,
        stats
      )
    }
    let sum = 0
    for (let i = 0; i < count; i++) {
      sum += this.evaluateScenarios(
        bank,
        `${seed}:scenario:${i}`,
        frames,
        agent,
        gameAgent,
        nextEpisodeIndex,
        breakdowns,
        stats
      )
    }
    return sum / count
  }

  private evaluateFullGameMultiSeed(
    seed: string,
    frames: ActionFrames,
    agent: StepAgent,
    gameAgent: GameAgent,
    nextEpisodeIndex: () => number,
    breakdowns?: FitnessBreakdown[],
    stats?: StatsRecorder
  ): number {
    const count = this.config.fullGameSeedsPerOrganism
    if (count <= 1) {
      return this.evaluateFullGame(
        seed,
        frames,
        agent,
        gameAgent,
        nextEpisodeIndex,
        breakdowns,
        stats
      )
    }
    let sum = 0
    for (let i = 0; i < count; i++) {
      sum += this.evaluateFullGame(
        `${seed}:fullgame:${i}`,
        frames,
        agent,
        gameAgent,
        nextEpisodeIndex,
        breakdowns,
        stats
      )
    }
    return sum / count
  }

  private evaluateFullGame(
    seed: string,
    frames: ActionFrames,
    agent: StepAgent,
    gameAgent: GameAgent,
    nextEpisodeIndex: () => number,
    breakdowns?: FitnessBreakdown[],
    stats?: StatsRecorder
  ): number {
    const episodeIndex = nextEpisodeIndex()
    agent.startEpisode({
      episodeIndex,
      type: 'full-game',
      metadata: { seed },
    })

    const hooks = this.buildSimulationHooks(
      agent,
      gameAgent,
      this.config.rewardConfig
    )
    const metrics = simulateGame(
      gameAgent.agent,
      this.config.simulation,
      seed,
      hooks
    )

    frames.thrustFrames += metrics.thrustFrames
    frames.fireFrames += metrics.fireFrames
    frames.leftFrames += metrics.leftFrames
    frames.rightFrames += metrics.rightFrames
    frames.aliveFrames += metrics.aliveFrames

    const fitness = this.scoreMetricsWithBreakdown(metrics, breakdowns, stats)
    const terminated = metrics.livesRemaining <= 0

    agent.endEpisode({
      fitness,
      episodeReturn: 0,
      totalSteps: metrics.elapsedTicks,
      terminated,
      metadata: { seed },
    })
    gameAgent.resetMemory()

    return fitness
  }

  private evaluateScenarios(
    bank: ScenarioSnapshot[],
    seed: string,
    frames: ActionFrames,
    agent: StepAgent,
    gameAgent: GameAgent,
    nextEpisodeIndex: () => number,
    breakdowns?: FitnessBreakdown[],
    stats?: StatsRecorder
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
      const episodeIndex = nextEpisodeIndex()
      const scenarioSeed = `${seed}:${scenario.id}`

      agent.startEpisode({
        episodeIndex,
        type: 'scenario',
        metadata: { id: scenario.id, seed: scenarioSeed },
      })

      const hooks = this.buildSimulationHooks(
        agent,
        gameAgent,
        this.config.rewardConfig,
        scenario.necklace ?? undefined
      )
      const metrics = simulateScenario(
        gameAgent.agent,
        scenario,
        scenarioConfig,
        scenarioSeed,
        hooks
      )

      frames.thrustFrames += metrics.thrustFrames
      frames.fireFrames += metrics.fireFrames
      frames.leftFrames += metrics.leftFrames
      frames.rightFrames += metrics.rightFrames
      frames.aliveFrames += metrics.aliveFrames

      const fitness = this.scoreMetricsWithBreakdown(metrics, breakdowns, stats)
      const terminated = metrics.livesRemaining <= 0

      agent.endEpisode({
        fitness,
        episodeReturn: 0,
        totalSteps: metrics.elapsedTicks,
        terminated,
        metadata: { id: scenario.id, seed: scenarioSeed },
      })
      gameAgent.resetMemory()

      fitnessSum += fitness
    }

    return fitnessSum / selected.length
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
      ...(this.config.outputCount != null && {
        outputCount: this.config.outputCount,
      }),
    }
  }
}
