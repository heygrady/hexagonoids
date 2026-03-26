/**
 * Diagnostic: inspect reward-fitness alignment during training.
 *
 * Runs a short training loop with gauntlet breakdown recording, then reports
 * how structured reward components align with raw and gated fitness.
 */
import {
  DEFAULT_HEXAGONOIDS_ENVIRONMENT_CONFIG,
  METRIC_GAUNTLET_BREAKDOWN,
  type GauntletBreakdown,
  type RewardConfig,
} from '@heygrady/hexagonoids-environment'
import { createMemoryRecorder } from '@neat-evolution/stats'
import type { TrainOptions } from '../training/train.js'
import { train } from '../training/train.js'
import { resolveRewardConfig } from '../runtime/buildEnvironmentOptions.js'
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
  }
}

export async function runInspectRewards(
  options: InspectRewardsOptions
): Promise<void> {
  const pc = (options.profileConfig ?? {}) as Partial<TrainOptions>
  const rewardConfig = options.rewardConfig

  console.log('\n=== Reward-Fitness Alignment ===')
  console.log(
    `Population: ${options.populationSize}  Iterations: ${options.iterations}  Seed: "${options.seed}"`
  )
  console.log(
    `Reward config: kill=${rewardConfig.rockReward} death=${rewardConfig.deathPenalty} survival=${rewardConfig.survivalReward} engagement=${rewardConfig.engagementReward} progress=${rewardConfig.progressReward} shotPenalty=${rewardConfig.shotPenalty} aim=${rewardConfig.bulletAimReward}`
  )
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
    earlyStopPatience: options.iterations + 1,
    secondsLimit: 0,
    rlRewardRock: rewardConfig.rockReward,
    rlRewardDeath: rewardConfig.deathPenalty,
    rlRewardSurvival: rewardConfig.survivalReward,
    rlRewardEngagement: rewardConfig.engagementReward,
    rlRewardProgress: rewardConfig.progressReward,
    rlRewardScoreScale: rewardConfig.scoreScale,
    rlRewardShotPenalty: rewardConfig.shotPenalty,
    rlRewardWaveBonus: rewardConfig.waveBonus,
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
