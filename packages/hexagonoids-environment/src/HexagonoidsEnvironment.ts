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
import { createRNG, type RNG } from '@neat-evolution/utils'
import { createGameAgent, type GameAgent } from './agents/createGameAgent.js'
import { MEMORY_ROCK_PERCEPTION } from './agents/types.js'
import type { CurriculumScenarioParams } from './curriculum/generateCurriculumScenario.js'
import { runCurriculum } from './curriculum/runCurriculum.js'
import type { RockPerceptionPrecompute } from './encoding/collectObservations.js'
import { INPUT_COUNT } from './encoding/encodingPresets.js'
import { computeFireTimeAimReward } from './evaluation/bulletAimReward.js'
import {
  type ActionFrames,
  applyBehavioralGates,
  computeFitnessBreakdown,
  computeGateBreakdown,
  type FitnessBreakdown,
  type FitnessContext,
  type GauntletBreakdown,
  type RewardBreakdown,
  type RewardBreakdownByMode,
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
import {
  DEFAULT_BEHAVIORAL_GATE_CONFIG,
  mergeConfig,
} from './HexagonoidsEnvironmentConfig.js'
import { simulateScenario } from './scenarios/simulateScenario.js'
import {
  buildStratifiedIndex,
  type StratifiedIndex,
  stratifiedSample,
} from './scenarios/stratifiedSample.js'
import type { ScenarioSnapshot } from './scenarios/types.js'

const DEFAULT_OUTPUT_COUNT = 4
const PLAYER_ID = 'player-1'

type RewardMode = 'scenarios' | 'fullGame' | 'curriculum'

interface RewardAccumulator {
  total: number
  breakdown: RewardBreakdownByMode
}

function createEmptyRewardBreakdown(): RewardBreakdown {
  return {
    survival: 0,
    thrust: 0,
    engagement: 0,
    progress: 0,
    kill: 0,
    score: 0,
    aim: 0,
    shotPenalty: 0,
    death: 0,
    waveBonus: 0,
    actionBand: 0,
    total: 0,
  }
}

function createRewardAccumulator(): RewardAccumulator {
  return {
    total: 0,
    breakdown: {
      scenarios: createEmptyRewardBreakdown(),
      fullGame: createEmptyRewardBreakdown(),
      curriculum: createEmptyRewardBreakdown(),
      total: createEmptyRewardBreakdown(),
    },
  }
}

function cloneRewardBreakdown(breakdown: RewardBreakdown): RewardBreakdown {
  return { ...breakdown }
}

function cloneRewardBreakdownByMode(
  breakdown: RewardBreakdownByMode
): RewardBreakdownByMode {
  return {
    scenarios: cloneRewardBreakdown(breakdown.scenarios),
    fullGame: cloneRewardBreakdown(breakdown.fullGame),
    curriculum: cloneRewardBreakdown(breakdown.curriculum),
    total: cloneRewardBreakdown(breakdown.total),
  }
}

function addRewardComponent(
  accumulator: RewardAccumulator,
  mode: RewardMode,
  component: keyof RewardBreakdown,
  value: number
): void {
  if (value === 0) return
  const modeBucket = accumulator.breakdown[mode]
  const totalBucket = accumulator.breakdown.total
  modeBucket[component] += value
  totalBucket[component] += value
  if (component !== 'total') {
    modeBucket.total += value
    totalBucket.total += value
  }
  accumulator.total = accumulator.breakdown.total.total
}

function computeEngagementSignal(
  rockPerception: RockPerceptionPrecompute | undefined
): number {
  if (rockPerception == null) return 0
  let best = 0
  for (const rock of rockPerception.rocks) {
    if (rock == null || rock.id === '' || rock.inVisionRange !== true) continue
    const distance = Math.min(1, Math.hypot(rock.localX, rock.localY))
    const score = 1 - distance
    if (score > best) best = score
  }
  return best
}

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
  private currentRewardAccumulator: RewardAccumulator | undefined

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
    const evaluationRng =
      context?.rng != null ? context.rng.derive('evaluation') : undefined
    return this.evaluateGauntlet({
      evaluationRng,
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
    evaluationRng,
    agent,
    gameAgent,
    stats,
  }: {
    evaluationRng: RNG | undefined
    agent: StepAgent
    gameAgent: GameAgent
    stats: StatsRecorder | undefined
  }): number {
    const gauntletRng = evaluationRng?.derive('gauntlet')
    const seed = gauntletRng?.toSeed() ?? this.nextAgentSeed()
    const bank = this.config.scenarioBank
    const hasBank = bank != null && bank.length > 0

    // Check what stats are wanted (zero-cost when no recorder)
    const wantsBreakdown = stats?.wants(METRIC_GAUNTLET_BREAKDOWN) === true
    const wantsEpisode = stats?.wants(METRIC_EPISODE_FITNESS) === true
    const wantsStats = wantsBreakdown || wantsEpisode

    // Determine active weights — zero out unavailable evaluation modes.
    // Scenarios need a bank; curriculum is enabled by having weight > 0.
    let sw = hasBank ? this.config.scenarioWeight : 0
    let fw = this.config.fullGameWeight
    let cw = this.config.curriculumWeight

    // Accumulate frame counts across all episodes for aggregated behavioral gates
    const frames: ActionFrames = {
      thrustFrames: 0,
      fireFrames: 0,
      leftFrames: 0,
      rightFrames: 0,
      aliveFrames: 0,
    }

    // Accumulate RL reward across all episodes
    const rewardAccumulator = createRewardAccumulator()
    this.currentRewardAccumulator = rewardAccumulator

    // Collect per-episode breakdowns when stats active
    const scenarioBreakdowns: FitnessBreakdown[] = []
    const fullGameBreakdowns: FitnessBreakdown[] = []
    const curriculumBreakdowns: FitnessBreakdown[] = []
    const curriculumParams: CurriculumScenarioParams[] = []

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
      const bgConfig =
        this.config.behavioralGateConfig ?? DEFAULT_BEHAVIORAL_GATE_CONFIG
      const gatedFitness = applyBehavioralGates(fitness, frames, bgConfig)

      if (wantsBreakdown && stats != null) {
        const gates = computeGateBreakdown(frames, bgConfig)
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
          rewardBreakdown: cloneRewardBreakdown(rewardAccumulator.breakdown.total),
          rewardBreakdownByMode: cloneRewardBreakdownByMode(
            rewardAccumulator.breakdown
          ),
          totalReward: rewardAccumulator.total,
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
        stats,
        wantsStats ? curriculumParams : undefined
      )
    }

    const blendedFitnessRaw =
      sw * scenarioFitness + fw * fullGameFitness + cw * curriculumFitness

    // Apply behavioral gates on aggregated frame counts
    const bgConfig =
      this.config.behavioralGateConfig ?? DEFAULT_BEHAVIORAL_GATE_CONFIG
    const gatedFitness = applyBehavioralGates(
      blendedFitnessRaw,
      frames,
      bgConfig
    )

    if (wantsBreakdown && stats != null) {
      const gates = computeGateBreakdown(frames, bgConfig)
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
        curriculumParams,
        aggregatedFrames: { ...frames },
        rewardBreakdown: cloneRewardBreakdown(rewardAccumulator.breakdown.total),
        rewardBreakdownByMode: cloneRewardBreakdownByMode(
          rewardAccumulator.breakdown
        ),
        totalReward: rewardAccumulator.total,
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
    rewardMode: RewardMode,
    rewardConfig?: Partial<RewardConfig>,
    situationClass?: number
  ): SimulationHooks {
    const rewardAccumulator = this.currentRewardAccumulator
    const resolvedRewardConfig: RewardConfig = {
      ...DEFAULT_REWARD_CONFIG,
      ...rewardConfig,
    }
    const dtMs = this.config.simulation.dtMs
    let episodeStartTime: number | undefined
    let previousEngagement = 0
    return {
      onAfterTick(deltas: TickDeltas, snapshot) {
        // Capture game time on first tick to filter pre-existing bullets
        if (episodeStartTime === undefined) {
          episodeStartTime = snapshot.state.now
        }
        let reward = 0
        const rewardTerms = createEmptyRewardBreakdown()
        if (deltas.shipAlive) {
          rewardTerms.survival += resolvedRewardConfig.survivalReward
          if (deltas.thrustActive) {
            rewardTerms.thrust += resolvedRewardConfig.thrustReward
          }
        }
        reward += rewardTerms.survival + rewardTerms.thrust
        if (deltas.scoreDelta !== 0) {
          rewardTerms.score += deltas.scoreDelta * resolvedRewardConfig.scoreScale
          reward += rewardTerms.score
        }
        if (deltas.rocksDestroyed > 0) {
          rewardTerms.kill +=
            deltas.rocksDestroyed * resolvedRewardConfig.rockReward
          reward += rewardTerms.kill
        }
        if (deltas.lifeDelta < 0) {
          rewardTerms.death +=
            resolvedRewardConfig.deathPenalty * Math.abs(deltas.lifeDelta)
          reward += rewardTerms.death
        }
        if (deltas.newBullets > 0) {
          rewardTerms.shotPenalty -=
            deltas.newBullets * resolvedRewardConfig.shotPenalty
          reward += rewardTerms.shotPenalty
        }
        if (deltas.waveChanged) {
          rewardTerms.waveBonus += resolvedRewardConfig.waveBonus
          reward += rewardTerms.waveBonus
        }

        const rockPerception = snapshot.context.memory[
          MEMORY_ROCK_PERCEPTION
        ] as RockPerceptionPrecompute | undefined
        const engagementSignal = computeEngagementSignal(rockPerception)
        if (resolvedRewardConfig.engagementReward !== 0 && engagementSignal > 0) {
          rewardTerms.engagement +=
            resolvedRewardConfig.engagementReward * engagementSignal
          reward += rewardTerms.engagement
        }
        if (
          resolvedRewardConfig.progressReward !== 0 &&
          previousEngagement > 0 &&
          engagementSignal > previousEngagement
        ) {
          rewardTerms.progress +=
            resolvedRewardConfig.progressReward *
            (engagementSignal - previousEngagement)
          reward += rewardTerms.progress
        }
        previousEngagement = engagementSignal

        // Bullet aim reward — fire-time intercept prediction
        if (deltas.newBullets > 0 && resolvedRewardConfig.bulletAimReward > 0) {
          const player = snapshot.state.players.get(snapshot.playerId)
          const ship =
            player?.shipId != null
              ? snapshot.state.ships.get(player.shipId)
              : undefined
          if (ship != null) {
            rewardTerms.aim += computeFireTimeAimReward(
              snapshot.state,
              ship,
              resolvedRewardConfig,
              dtMs,
              episodeStartTime
            )
            reward += rewardTerms.aim
          }
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

        if (rewardAccumulator != null) {
          const components: Array<keyof RewardBreakdown> = [
            'survival',
            'thrust',
            'engagement',
            'progress',
            'kill',
            'score',
            'aim',
            'shotPenalty',
            'death',
            'waveBonus',
            'actionBand',
          ]
          for (const component of components) {
            addRewardComponent(
              rewardAccumulator,
              rewardMode,
              component,
              rewardTerms[component]
            )
          }
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
    stats: StatsRecorder | undefined,
    maxTicks?: number
  ): number {
    const deathBudgetTicks = maxTicks ?? metrics.elapsedTicks
    const context: FitnessContext = {
      possibleDeaths: computePossibleDeaths(
        deathBudgetTicks,
        this.config.simulation.dtMs
      ),
      dtMs: this.config.simulation.dtMs,
      ...(maxTicks != null ? { maxTicks } : {}),
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
    stats?: StatsRecorder,
    paramsOut?: CurriculumScenarioParams[]
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
      return this.buildSimulationHooks(
        agent,
        gameAgent,
        'curriculum',
        this.config.rewardConfig
      )
    }

    const results = runCurriculum(
      gameAgent.agent,
      seed,
      dtMs,
      curriculumCount,
      hooksFactory
    )

    if (results.length === 0) return 0

    let fitnessSum = 0
    for (const [index, { metrics, params }] of results.entries()) {
      frames.thrustFrames += metrics.thrustFrames
      frames.fireFrames += metrics.fireFrames
      frames.leftFrames += metrics.leftFrames
      frames.rightFrames += metrics.rightFrames
      frames.aliveFrames += metrics.aliveFrames

      if (paramsOut != null) {
        paramsOut.push(params)
      }

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

    return fitnessSum / results.length
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
      'fullGame',
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

    const fitness = this.scoreMetricsWithBreakdown(
      metrics,
      breakdowns,
      stats,
      this.config.simulation.maxTicks
    )
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
        'scenarios',
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

      const fitness = this.scoreMetricsWithBreakdown(
        metrics,
        breakdowns,
        stats,
        this.config.simulation.scenarioMaxTicks
      )
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
      ...(this.config.rewardConfig != null && {
        rewardConfig: this.config.rewardConfig,
      }),
    }
  }
}
