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
  computeGateBreakdown,
  applyBehavioralGates,
  computeFitnessBreakdown,
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
  type RewardMode,
  type SimulationSnapshot,
  type SimulationHooks,
  simulateGame,
  type TickDeltas,
} from './evaluation/simulateGame.js'
import type { HexagonoidsEnvironmentConfig } from './HexagonoidsEnvironmentConfig.js'
import {
  DEFAULT_BEHAVIORAL_GATE_CONFIG,
  mergeConfig,
} from './HexagonoidsEnvironmentConfig.js'
import {
  resolveRuntimeScoringHooks,
  type ResolvedRuntimeScoringHooks,
} from './runtimeHooks.js'
import { applyRewardHookAdjustments, mergeRuntimeHookAnnotations } from './runtimeHooks/shared.js'
import type { RuntimeHookAnnotations } from './runtimeHooksTypes.js'
import { simulateScenario } from './scenarios/simulateScenario.js'
import {
  buildStratifiedIndex,
  type StratifiedIndex,
  stratifiedSample,
} from './scenarios/stratifiedSample.js'
import type { ScenarioSnapshot } from './scenarios/types.js'

const DEFAULT_OUTPUT_COUNT = 7
const PLAYER_ID = 'player-1'

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
    actionBand: 0,
    turnConflict: 0,
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

interface TacticalPotentials {
  /** Quality of the best currently attackable visible rock. */
  targetAccess: number
  /** How manageable the immediate encounter looks overall. */
  encounterControl: number
}

interface VisibleRockSummary {
  visibleCount: number
  bestAccess: number
  secondAccess: number
  averageAccess: number
}

interface RollingActionWindow {
  frames: Array<{
    thrust: boolean
    fire: boolean
    left: boolean
    right: boolean
  }>
  counts: ActionFrames
}

function computeTargetAccessPotential(
  rockPerception: RockPerceptionPrecompute | undefined
): number {
  const summary = summarizeVisibleRocks(rockPerception)
  if (summary.visibleCount === 0) return 0

  const focus = Math.max(0, summary.bestAccess - 0.5 * summary.secondAccess)
  return Math.min(
    1,
    0.55 * summary.bestAccess +
      0.25 * summary.averageAccess +
      0.2 * focus
  )
}

function computeEncounterControlPotential(
  rockPerception: RockPerceptionPrecompute | undefined,
  rockCount: number
): number {
  // Cheap proxy for "is this fight getting easier to finish?" without
  // conflating control with button activity.
  const summary = summarizeVisibleRocks(rockPerception)
  const burdenRelief = 1 / (1 + Math.max(0, rockCount) / 3)
  const localSimplicity =
    summary.visibleCount <= 1
      ? 1
      : 1 / (1 + (summary.visibleCount - 1) / 2)
  const focus = Math.max(0, summary.bestAccess - 0.5 * summary.secondAccess)
  const localControl =
    summary.visibleCount === 0
      ? 0.2
      : Math.min(
          1,
          0.55 * focus +
            0.25 * localSimplicity +
            0.2 * summary.averageAccess
        )

  return Math.min(
    1,
    0.5 * burdenRelief + 0.3 * localControl + 0.2 * summary.bestAccess
  )
}

function computeTacticalPotentials(
  rockPerception: RockPerceptionPrecompute | undefined,
  rockCount: number
): TacticalPotentials {
  const targetAccess = computeTargetAccessPotential(rockPerception)
  return {
    targetAccess,
    encounterControl: computeEncounterControlPotential(
      rockPerception,
      rockCount
    ),
  }
}

function summarizeVisibleRocks(
  rockPerception: RockPerceptionPrecompute | undefined
): VisibleRockSummary {
  if (rockPerception == null) {
    return {
      visibleCount: 0,
      bestAccess: 0,
      secondAccess: 0,
      averageAccess: 0,
    }
  }

  let visibleCount = 0
  let bestAccess = 0
  let secondAccess = 0
  let accessSum = 0

  for (const rock of rockPerception.rocks) {
    if (rock == null || rock.id === '' || rock.inVisionRange !== true) continue

    visibleCount += 1
    const distance = Math.min(1, Math.hypot(rock.localX, rock.localY))
    const proximity = 1 - distance
    const forwardness =
      distance > 1e-9 ? Math.max(0, rock.localY / distance) : 1
    const centeredness = 1 - Math.min(1, Math.abs(rock.localX))
    const sizeBonus = Math.min(1, rock.radius / 0.055)
    const attackLane = 1 - Math.min(1, Math.abs(rock.localX) / (0.08 + 2.5 * rock.radius + 0.35 * distance))
    const access = Math.min(
      1,
      proximity *
        (0.35 * forwardness +
          0.35 * attackLane +
          0.2 * centeredness +
          0.1 * sizeBonus)
    )

    accessSum += access
    if (access >= bestAccess) {
      secondAccess = bestAccess
      bestAccess = access
    } else if (access > secondAccess) {
      secondAccess = access
    }
  }

  return {
    visibleCount,
    bestAccess,
    secondAccess,
    averageAccess: visibleCount > 0 ? accessSum / visibleCount : 0,
  }
}

const ACTION_BAND_WINDOW_SIZE = 64
const ACTION_BAND_MIN_SAMPLES = 32

function createRollingActionWindow(): RollingActionWindow {
  return {
    frames: [],
    counts: {
      thrustFrames: 0,
      fireFrames: 0,
      turnFrames: 0,
      leftFrames: 0,
      rightFrames: 0,
      turnConflictFrames: 0,
      turnAmbiguousFrames: 0,
      aliveFrames: 0,
    },
  }
}

function updateRollingActionWindow(
  window: RollingActionWindow,
  inputs: {
    thrust: boolean
    fire: boolean
    left: boolean
    right: boolean
  },
  shipAlive: boolean
): void {
  if (!shipAlive) return
  const frame = {
    thrust: inputs.thrust,
    fire: inputs.fire,
    left: inputs.left,
    right: inputs.right,
  }
  window.frames.push(frame)
  window.counts.aliveFrames += 1
  if (frame.thrust) window.counts.thrustFrames += 1
  if (frame.fire) window.counts.fireFrames += 1
  if (frame.left || frame.right) window.counts.turnFrames += 1
  if (frame.left) window.counts.leftFrames += 1
  if (frame.right) window.counts.rightFrames += 1

  if (window.frames.length > ACTION_BAND_WINDOW_SIZE) {
    const removed = window.frames.shift()
    if (removed != null) {
      window.counts.aliveFrames -= 1
      if (removed.thrust) window.counts.thrustFrames -= 1
      if (removed.fire) window.counts.fireFrames -= 1
      if (removed.left || removed.right) window.counts.turnFrames -= 1
      if (removed.left) window.counts.leftFrames -= 1
      if (removed.right) window.counts.rightFrames -= 1
    }
  }
}

function computeRollingActionBandCost(
  window: RollingActionWindow,
  config: HexagonoidsEnvironmentConfig['behavioralGateConfig'],
  coefficient: number
): number {
  if (coefficient === 0) return 0
  if (window.counts.aliveFrames < ACTION_BAND_MIN_SAMPLES) return 0
  const gates = computeGateBreakdown(
    window.counts,
    config ?? DEFAULT_BEHAVIORAL_GATE_CONFIG
  )
  return -coefficient * (1 - gates.combined)
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
  private readonly runtimeHooks: ResolvedRuntimeScoringHooks
  private agentSeedCounter = 0
  private currentRewardAccumulator: RewardAccumulator | undefined
  private currentHookAnnotations:
    | {
        reward?: RuntimeHookAnnotations | undefined
        fitness?: RuntimeHookAnnotations | undefined
      }
    | undefined

  constructor(
    config?: Partial<HexagonoidsEnvironmentConfig>,
    initOptions?: EnvironmentInitOptions
  ) {
    this.config = mergeConfig(config)
    this.runtimeHooks = resolveRuntimeScoringHooks(this.config.runtimeHooks)
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
      turnFrames: 0,
      leftFrames: 0,
      rightFrames: 0,
      turnConflictFrames: 0,
      turnAmbiguousFrames: 0,
      aliveFrames: 0,
    }

    // Accumulate RL reward across all episodes
    const rewardAccumulator = createRewardAccumulator()
    this.currentRewardAccumulator = rewardAccumulator
    this.currentHookAnnotations =
      this.config.runtimeHooks != null ? {} : undefined

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
      const breakdown = this.finalizeGauntletBreakdown({
        fitness: gatedFitness,
        blendedFitnessRaw: fitness,
        scenarioFitness: 0,
        fullGameFitness: fitness,
        curriculumFitness: 0,
        gates: computeGateBreakdown(frames, bgConfig),
        scenarioBreakdowns: [],
        fullGameBreakdowns,
        curriculumBreakdowns: [],
        aggregatedFrames: { ...frames },
        rewardBreakdown: cloneRewardBreakdown(rewardAccumulator.breakdown.total),
        rewardBreakdownByMode: cloneRewardBreakdownByMode(
          rewardAccumulator.breakdown
        ),
        totalReward: rewardAccumulator.total,
      })

      if (wantsBreakdown && stats != null) {
        stats.record(METRIC_GAUNTLET_BREAKDOWN, breakdown)
      }

      return breakdown.fitness
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
    const breakdown = this.finalizeGauntletBreakdown({
      fitness: gatedFitness,
      blendedFitnessRaw,
      scenarioFitness,
      fullGameFitness,
      curriculumFitness,
      gates: computeGateBreakdown(frames, bgConfig),
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
    })

    if (wantsBreakdown && stats != null) {
      stats.record(METRIC_GAUNTLET_BREAKDOWN, breakdown)
    }

    return breakdown.fitness
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
    const behavioralGateConfig =
      this.config.behavioralGateConfig ?? DEFAULT_BEHAVIORAL_GATE_CONFIG
    let episodeStartTime: number | undefined
    let previousPotentials: TacticalPotentials | undefined
    const actionWindow = createRollingActionWindow()
    return {
      onAfterTick: (deltas: TickDeltas, snapshot: SimulationSnapshot) => {
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
        if (snapshot.turnConflict) {
          rewardTerms.turnConflict -= resolvedRewardConfig.turnConflictPenalty
          reward += rewardTerms.turnConflict
        }

        updateRollingActionWindow(
          actionWindow,
          snapshot.inputs,
          deltas.shipAlive
        )
        rewardTerms.actionBand += computeRollingActionBandCost(
          actionWindow,
          behavioralGateConfig,
          resolvedRewardConfig.actionBandCost
        )
        reward += rewardTerms.actionBand

        const rockPerception = snapshot.context.memory[
          MEMORY_ROCK_PERCEPTION
        ] as RockPerceptionPrecompute | undefined
        const currentPotentials = computeTacticalPotentials(
          rockPerception,
          snapshot.state.rocks.size
        )
        if (previousPotentials != null) {
          const targetAccessDelta =
            currentPotentials.targetAccess - previousPotentials.targetAccess
          if (
            resolvedRewardConfig.engagementReward !== 0 &&
            targetAccessDelta !== 0
          ) {
            rewardTerms.engagement +=
              resolvedRewardConfig.engagementReward * targetAccessDelta
            reward += rewardTerms.engagement
          }

          const encounterControlDelta =
            currentPotentials.encounterControl -
            previousPotentials.encounterControl
          if (
            resolvedRewardConfig.progressReward !== 0 &&
            encounterControlDelta !== 0
          ) {
            rewardTerms.progress +=
              resolvedRewardConfig.progressReward * encounterControlDelta
            reward += rewardTerms.progress
          }
        }
        previousPotentials = currentPotentials

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

        const rewardHook = this.runtimeHooks.reward
        if (rewardHook != null && this.runtimeHooks.rewardRef != null) {
          const hookResult = rewardHook({
            hookId: this.runtimeHooks.rewardRef,
            rewardMode,
            deltas,
            snapshot,
            rewardConfig: resolvedRewardConfig,
            rewardTerms,
          })
          if (hookResult?.adjustments != null) {
            reward += applyRewardHookAdjustments(
              rewardTerms,
              hookResult.adjustments
            )
          }
          if (hookResult?.annotations != null) {
            this.currentHookAnnotations = {
              ...(this.currentHookAnnotations ?? {}),
              reward: mergeRuntimeHookAnnotations(
                this.currentHookAnnotations?.reward,
                hookResult.annotations
              ),
            }
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
            'actionBand',
            'turnConflict',
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

  private finalizeGauntletBreakdown(
    breakdown: GauntletBreakdown
  ): GauntletBreakdown {
    const finalized: GauntletBreakdown = {
      ...breakdown,
      ...(this.config.runtimeHooks != null
        ? { activeHooks: { ...this.config.runtimeHooks } }
        : {}),
      ...(this.currentHookAnnotations != null
        ? {
            hookAnnotations: {
              ...(this.currentHookAnnotations.reward != null
                ? { reward: { ...this.currentHookAnnotations.reward } }
                : {}),
            },
          }
        : {}),
    }

    const fitnessHook = this.runtimeHooks.fitness
    if (fitnessHook != null && this.runtimeHooks.fitnessRef != null) {
      const hookResult = fitnessHook({
        hookId: this.runtimeHooks.fitnessRef,
        breakdown: finalized,
        config: {
          fitnessWeights: this.config.fitnessWeights,
          gateConfig: this.config.gateConfig,
          behavioralGateConfig: this.config.behavioralGateConfig,
          rewardConfig: this.config.rewardConfig,
          scenarioWeight: this.config.scenarioWeight,
          fullGameWeight: this.config.fullGameWeight,
          curriculumWeight: this.config.curriculumWeight,
        },
      })

      if (
        typeof hookResult?.blendedFitnessRaw === 'number' &&
        Number.isFinite(hookResult.blendedFitnessRaw)
      ) {
        finalized.blendedFitnessRaw = hookResult.blendedFitnessRaw
      }
      if (
        typeof hookResult?.fitness === 'number' &&
        Number.isFinite(hookResult.fitness)
      ) {
        finalized.fitness = hookResult.fitness
      }
      if (hookResult?.annotations != null) {
        finalized.hookAnnotations = {
          ...(finalized.hookAnnotations ?? {}),
          fitness: mergeRuntimeHookAnnotations(
            finalized.hookAnnotations?.fitness,
            hookResult.annotations
          ),
        }
      }
    }

    return finalized
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
      frames.turnFrames += metrics.turnFrames
      frames.leftFrames += metrics.leftFrames
      frames.rightFrames += metrics.rightFrames
      frames.turnConflictFrames += metrics.turnConflictFrames
      frames.turnAmbiguousFrames += metrics.turnAmbiguousFrames
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
    frames.turnFrames += metrics.turnFrames
    frames.leftFrames += metrics.leftFrames
    frames.rightFrames += metrics.rightFrames
    frames.turnConflictFrames += metrics.turnConflictFrames
    frames.turnAmbiguousFrames += metrics.turnAmbiguousFrames
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
      frames.turnFrames += metrics.turnFrames
      frames.leftFrames += metrics.leftFrames
      frames.rightFrames += metrics.rightFrames
      frames.turnConflictFrames += metrics.turnConflictFrames
      frames.turnAmbiguousFrames += metrics.turnAmbiguousFrames
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
      ...(this.config.behavioralGateConfig != null && {
        behavioralGateConfig: {
          ...this.config.behavioralGateConfig,
          thrust: { ...this.config.behavioralGateConfig.thrust },
          fire: { ...this.config.behavioralGateConfig.fire },
          turn: { ...this.config.behavioralGateConfig.turn },
          turnBias: { ...this.config.behavioralGateConfig.turnBias },
        },
      }),
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
      ...(this.config.runtimeHooks != null && {
        runtimeHooks: {
          ...this.config.runtimeHooks,
        },
      }),
    }
  }
}
