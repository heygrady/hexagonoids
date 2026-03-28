/**
 * Diagnostic: inspect reward-fitness alignment during training.
 *
 * Runs a short training loop with gauntlet breakdown recording, then reports
 * how structured reward components align with raw and gated fitness.
 */
import {
  computeGateBreakdown,
  DEFAULT_BEHAVIORAL_GATE_CONFIG,
  DEFAULT_HEXAGONOIDS_ENVIRONMENT_CONFIG,
  METRIC_GAUNTLET_BREAKDOWN,
  mergeConfig,
  SHAPING_TERM_SEMANTICS,
  type BehavioralGateConfig,
  type GauntletBreakdown,
  type RewardConfig,
} from '@heygrady/hexagonoids-environment'
import { createMemoryRecorder } from '@neat-evolution/stats'
import { buildEnvironmentOptions, resolveRewardConfig } from '../runtime/buildEnvironmentOptions.js'
import type { TrainOptions } from '../training/train.js'
import { train } from '../training/train.js'
import {
  fmtNum,
  pearsonCorrelation,
  summarizeGenerationAlignment,
} from './rewardAlignment.js'

export interface InspectRewardsOptions {
  seed: string
  method: string
  rewardConfig: RewardConfig
  populationSize: number
  iterations: number
  topN: number
  showComponents: boolean
  showModes: boolean
  showFitnessViews: boolean
  profileConfig?: Partial<TrainOptions> | undefined
}

export function defaultInspectRewardsOptions(): InspectRewardsOptions {
  return {
    seed: 'inspect-rewards-001',
    method: 'HyperNEAT',
    rewardConfig: resolveRewardConfig({}),
    populationSize: 25,
    iterations: 15,
    topN: 3,
    showComponents: false,
    showModes: false,
    showFitnessViews: false,
  }
}

function formatBehavioralGateConfig(config: BehavioralGateConfig): string {
  return [
    `thrust[low=${fmtNum(config.thrust.low, 3)} high=${fmtNum(
      config.thrust.high,
      3
    )} easing=${config.thrust.easing} floor=${fmtNum(config.thrust.floor, 3)}]`,
    `fire[low=${fmtNum(config.fire.low, 3)} high=${fmtNum(
      config.fire.high,
      3
    )} easing=${config.fire.easing} floor=${fmtNum(config.fire.floor, 3)}]`,
    `turn[low=${fmtNum(config.turn.low, 3)} high=${fmtNum(
      config.turn.high,
      3
    )} easing=${config.turn.easing} floor=${fmtNum(config.turn.floor, 3)}]`,
    `bias[max=${fmtNum(config.turnBias.max, 3)} easing=${config.turnBias.easing} floor=${fmtNum(config.turnBias.floor, 3)}]`,
    `combinedFloor=${fmtNum(config.floor, 3)}`,
  ].join(' ')
}

function formatTurnGateReferences(config: BehavioralGateConfig): string {
  const aliveFrames = 1000
  const thrustFrames = 400
  const fireFrames = 350
  const parts = [0.9, 0.95, 0.98, 1].map((turnFraction) => {
    const turnFrames = Math.round(aliveFrames * turnFraction)
    const directionalTurns = Math.max(2, turnFrames)
    const leftFrames = Math.floor(directionalTurns / 2)
    const rightFrames = directionalTurns - leftFrames
    const gate = computeGateBreakdown(
      {
        thrustFrames,
        fireFrames,
        turnFrames,
        leftFrames,
        rightFrames,
        turnConflictFrames: 0,
        turnAmbiguousFrames: 0,
        aliveFrames,
      },
      config
    ).turn
    return `${Math.round(turnFraction * 100)}%->${fmtNum(gate, 3)}`
  })
  return parts.join('  ')
}

function formatRuntimeHooks(
  hooks: Partial<TrainOptions>['runtimeHooks']
): string | null {
  if (hooks == null) return null
  const parts: string[] = []
  if (typeof hooks.reward === 'string') parts.push(`reward=${hooks.reward}`)
  if (typeof hooks.fitness === 'string') parts.push(`fitness=${hooks.fitness}`)
  return parts.length > 0 ? parts.join(' ') : null
}

export async function runInspectRewards(
  options: InspectRewardsOptions
): Promise<void> {
  const pc = (options.profileConfig ?? {}) as Partial<TrainOptions>
  const rewardConfig = options.rewardConfig
  const resolvedEnvironmentConfig = mergeConfig(buildEnvironmentOptions(pc))
  const behavioralGateConfig =
    resolvedEnvironmentConfig.behavioralGateConfig ??
    DEFAULT_BEHAVIORAL_GATE_CONFIG

  console.log('\n=== Reward-Fitness Alignment ===')
  console.log(
    `Population: ${options.populationSize}  Iterations: ${options.iterations}  Seed: "${options.seed}"`
  )
  console.log(
    `Reward config: objective[kill=${rewardConfig.rockReward} death=${rewardConfig.deathPenalty} scoreScale=${rewardConfig.scoreScale}] shaping[survival=${rewardConfig.survivalReward} thrust=${rewardConfig.thrustReward} engagement(${SHAPING_TERM_SEMANTICS.engagement}Delta)=${rewardConfig.engagementReward} progress(${SHAPING_TERM_SEMANTICS.progress}Delta)=${rewardConfig.progressReward} aim=${rewardConfig.bulletAimReward}] cost[shotPenalty=${rewardConfig.shotPenalty} actionBand=${rewardConfig.actionBandCost} turnConflict=${rewardConfig.turnConflictPenalty}]`
  )
  console.log(
    `Shaping semantics: engagement=${SHAPING_TERM_SEMANTICS.engagement}  progress=${SHAPING_TERM_SEMANTICS.progress}`
  )
  console.log(
    `Behavioral gates: ${formatBehavioralGateConfig(behavioralGateConfig)}`
  )
  console.log(
    `Turn gate refs: ${formatTurnGateReferences(behavioralGateConfig)}`
  )
  const runtimeHooks = formatRuntimeHooks(pc.runtimeHooks)
  if (runtimeHooks != null) {
    console.log(`Runtime hooks: ${runtimeHooks}`)
  }
  console.log()

  const recorder = createMemoryRecorder([METRIC_GAUNTLET_BREAKDOWN])

  const rawRewardCorrelations: number[] = []
  const gatedRewardCorrelations: number[] = []

  await train({
    method: options.method as 'HyperNEAT',
    populationSize: options.populationSize,
    iterations: options.iterations,
    baseSeed: options.seed,
    logInterval: 0,
    scenariosPerOrganism: pc.scenariosPerOrganism ?? 128,
    scenarioMaxTicks: pc.scenarioMaxTicks ?? 64,
    maxTicks: pc.maxTicks ?? 2048,
    dtMs:
      pc.dtMs ??
      DEFAULT_HEXAGONOIDS_ENVIRONMENT_CONFIG.simulation.dtMs,
    curriculumCount: pc.curriculumCount ?? 48,
    scenarioWeight: pc.scenarioWeight ?? 0.3,
    fullGameWeight: pc.fullGameWeight ?? 0.4,
    curriculumWeight: pc.curriculumWeight ?? 0.3,
    fullGameSeedsPerOrganism: pc.fullGameSeedsPerOrganism ?? 2,
    fitnessWeights: pc.fitnessWeights,
    gateConfig: pc.gateConfig,
    behavioralGateConfig: pc.behavioralGateConfig,
    runtimeHooks: pc.runtimeHooks,
    earlyStopPatience: options.iterations + 1,
    secondsLimit: 0,
    rlRewardRock: rewardConfig.rockReward,
    rlRewardDeath: rewardConfig.deathPenalty,
    rlRewardSurvival: rewardConfig.survivalReward,
    rlRewardEngagement: rewardConfig.engagementReward,
    rlRewardProgress: rewardConfig.progressReward,
    rlRewardActionBand: rewardConfig.actionBandCost,
    rlRewardTurnConflict: rewardConfig.turnConflictPenalty,
    rlRewardScoreScale: rewardConfig.scoreScale,
    rlRewardShotPenalty: rewardConfig.shotPenalty,
    rlRewardBulletAim: rewardConfig.bulletAimReward,
    rlRewardBulletAimOutOfRange: rewardConfig.bulletAimOutOfRangeScale,
    rlRewardBulletMissDemerit: rewardConfig.bulletMissDemerit,
    rlRewardThrust: rewardConfig.thrustReward,
    stats: recorder,
    afterEvaluate: (population: unknown, iteration: number) => {
      const allBreakdowns = recorder.get<GauntletBreakdown>(
        METRIC_GAUNTLET_BREAKDOWN
      )
      const genBreakdowns = allBreakdowns.slice(
        Math.max(0, allBreakdowns.length - options.populationSize)
      )
      if (genBreakdowns.length === 0) return

      const pop = population as { species: { size: number } }
      const speciesCount = pop.species.size
      const totalRewards = genBreakdowns.map((b) => b.rewardBreakdown.total)
      rawRewardCorrelations.push(
        pearsonCorrelation(
          genBreakdowns.map((b) => b.blendedFitnessRaw),
          totalRewards
        )
      )
      gatedRewardCorrelations.push(
        pearsonCorrelation(
          genBreakdowns.map((b) => b.fitness),
          totalRewards
        )
      )

      for (const line of summarizeGenerationAlignment(
        iteration,
        speciesCount,
        genBreakdowns,
        {
          topN: options.topN,
          showComponents: options.showComponents,
          showModes: options.showModes,
          showFitnessViews: options.showFitnessViews,
        }
      )) {
        console.log(line)
      }
    },
  })

  console.log()
  console.log('=== Alignment Summary ===')
  if (rawRewardCorrelations.length > 0) {
    const rawMean =
      rawRewardCorrelations.reduce((sum, value) => sum + value, 0) /
      rawRewardCorrelations.length
    const gatedMean =
      gatedRewardCorrelations.reduce((sum, value) => sum + value, 0) /
      gatedRewardCorrelations.length
    console.log(
      `  Mean rTotal->raw=${fmtNum(rawMean, 3)}  Mean rTotal->fit=${fmtNum(gatedMean, 3)}`
    )
    console.log(
      `  Raw range: ${fmtNum(Math.min(...rawRewardCorrelations), 3)}..${fmtNum(Math.max(...rawRewardCorrelations), 3)}`
    )
    console.log(
      `  Fit range: ${fmtNum(Math.min(...gatedRewardCorrelations), 3)}..${fmtNum(Math.max(...gatedRewardCorrelations), 3)}`
    )
    console.log(`  Generations: ${rawRewardCorrelations.length}`)
  }
  console.log()
}
