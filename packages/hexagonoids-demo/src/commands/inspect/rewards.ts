import { Flags } from '@oclif/core'
import { trainLikeFlags } from '../../command-base/shared-flags.js'
import { TrainLikeCommand } from '../../command-base/train-like-command.js'
import {
  defaultInspectRewardsOptions,
  runInspectRewards,
} from '../../features/inspect/inspectStepRewards.js'
import { resolveRewardConfig } from '../../features/runtime/buildEnvironmentOptions.js'

export default class InspectRewardsCommand extends TrainLikeCommand {
  static override summary =
    'Inspect reward-fitness alignment during training.'

  static override description =
    'Runs a training loop and reports per-generation alignment between structured reward components and fitness.'

  static override examples = [
    '<%= config.bin %> inspect rewards',
    '<%= config.bin %> inspect rewards --profile default --showComponents --topN 3',
  ]

  static override flags = {
    profile: trainLikeFlags.profile,
    seed: Flags.string({ summary: 'Base seed for training' }),
    method: Flags.string({ summary: 'Algorithm method (e.g. HyperNEAT)' }),
    populationSize: Flags.integer({
      summary: 'Population size',
      min: 5,
    }),
    iterations: Flags.integer({
      summary: 'Number of generations to run',
      min: 1,
    }),
    topN: Flags.integer({
      summary: 'Top organisms to print for each ranking slice',
      min: 1,
    }),
    showComponents: Flags.boolean({
      summary: 'Show per-component reward correlations',
    }),
    showModes: Flags.boolean({
      summary: 'Show reward totals split by scenario/fullGame/curriculum',
    }),
    rlRewardRock: trainLikeFlags.rlRewardRock,
    rlRewardDeath: trainLikeFlags.rlRewardDeath,
    rlRewardSurvival: trainLikeFlags.rlRewardSurvival,
    rlRewardEngagement: trainLikeFlags.rlRewardEngagement,
    rlRewardProgress: trainLikeFlags.rlRewardProgress,
    rlRewardScoreScale: trainLikeFlags.rlRewardScoreScale,
    rlRewardShotPenalty: trainLikeFlags.rlRewardShotPenalty,
    rlRewardWaveBonus: trainLikeFlags.rlRewardWaveBonus,
    rlRewardBulletAim: trainLikeFlags.rlRewardBulletAim,
    rlRewardBulletAimOutOfRange: trainLikeFlags.rlRewardBulletAimOutOfRange,
    rlRewardBulletMissDemerit: trainLikeFlags.rlRewardBulletMissDemerit,
    rlRewardThrust: trainLikeFlags.rlRewardThrust,
    scenarioWeight: trainLikeFlags.scenarioWeight,
    scenariosPerOrganism: trainLikeFlags.scenariosPerOrganism,
    scenarioMaxTicks: trainLikeFlags.scenarioMaxTicks,
    fullGameSeedsPerOrganism: trainLikeFlags.fullGameSeedsPerOrganism,
    maxTicks: trainLikeFlags.maxTicks,
    dtMs: trainLikeFlags.dtMs,
  }

  override async run(): Promise<void> {
    const { flags } = await this.parse(InspectRewardsCommand)
    const defaults = defaultInspectRewardsOptions()
    const profileRef =
      typeof flags.profile === 'string' ? flags.profile : undefined
    const profile = await this.resolveProfile(profileRef)
    const mergedOptions = this.mergeTrainOptions(
      profile.config,
      this.flagsToTrainOptions(flags)
    )

    await runInspectRewards({
      seed: typeof flags.seed === 'string' ? flags.seed : defaults.seed,
      method: typeof flags.method === 'string' ? flags.method : defaults.method,
      populationSize:
        typeof flags.populationSize === 'number'
          ? flags.populationSize
          : defaults.populationSize,
      iterations:
        typeof flags.iterations === 'number'
          ? flags.iterations
          : defaults.iterations,
      topN: typeof flags.topN === 'number' ? flags.topN : defaults.topN,
      showComponents:
        flags.showComponents === true ? true : defaults.showComponents,
      showModes: flags.showModes === true ? true : defaults.showModes,
      rewardConfig: resolveRewardConfig(mergedOptions),
      profileConfig: mergedOptions,
    })
  }
}
