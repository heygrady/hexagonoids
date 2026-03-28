import { Flags } from '@oclif/core'
import { trainLikeFlags } from '../../command-base/shared-flags.js'
import { TrainLikeCommand } from '../../command-base/train-like-command.js'
import { runRewardScreen } from '../../features/inspect/rewardScreen.js'
import { resolveRewardConfig } from '../../features/runtime/buildEnvironmentOptions.js'

export default class InspectScreenCommand extends TrainLikeCommand {
  static override summary =
    'Run a short reward-screening matrix across candidate configs.'

  static override description =
    'Runs a compact 3-generation screening loop comparing the carry-forward baseline, access-first shaping, and control-first shaping using inspect-style and RL-diagnostic-style metrics.'

  static override examples = [
    '<%= config.bin %> inspect screen --profile default',
    '<%= config.bin %> inspect screen --inspectIterations 3 --rlIterations 3',
  ]

  static override flags = {
    profile: trainLikeFlags.profile,
    seed: Flags.string({ summary: 'Base seed for screening runs' }),
    method: Flags.string({ summary: 'Algorithm method (e.g. HyperNEAT)' }),
    inspectIterations: Flags.integer({
      summary: 'Iterations for inspect-style candidate screening',
      min: 1,
      default: 3,
    }),
    inspectPopulationSize: Flags.integer({
      summary: 'Population size for inspect-style screening runs',
      min: 5,
      default: 25,
    }),
    rlIterations: Flags.integer({
      summary: 'Iterations for short RL screening runs',
      min: 1,
      default: 3,
    }),
    rlPopulationSize: Flags.integer({
      summary: 'Population size for short RL screening runs',
      min: 5,
      default: 32,
    }),
    rlRewardRock: trainLikeFlags.rlRewardRock,
    rlRewardDeath: trainLikeFlags.rlRewardDeath,
    rlRewardSurvival: trainLikeFlags.rlRewardSurvival,
    rlRewardEngagement: trainLikeFlags.rlRewardEngagement,
    rlRewardProgress: trainLikeFlags.rlRewardProgress,
    rlRewardActionBand: trainLikeFlags.rlRewardActionBand,
    rlRewardTurnConflict: trainLikeFlags.rlRewardTurnConflict,
    rlRewardScoreScale: trainLikeFlags.rlRewardScoreScale,
    rlRewardShotPenalty: trainLikeFlags.rlRewardShotPenalty,
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
    const { flags } = await this.parse(InspectScreenCommand)
    const profileRef =
      typeof flags.profile === 'string' ? flags.profile : undefined
    const profile = await this.resolveProfile(profileRef)
    const mergedOptions = this.mergeTrainOptions(
      this.profileToTrainOptions(profile),
      this.flagsToTrainOptions(flags)
    )

    this.logResolvedProfile(profile, mergedOptions)
    await runRewardScreen({
      seed:
        typeof flags.seed === 'string' ? flags.seed : 'reward-screen-001',
      method:
        typeof flags.method === 'string'
          ? flags.method
          : ((mergedOptions.method as string | undefined) ?? 'HyperNEAT'),
      inspectIterations: flags.inspectIterations,
      inspectPopulationSize: flags.inspectPopulationSize,
      rlIterations: flags.rlIterations,
      rlPopulationSize: flags.rlPopulationSize,
      profileConfig: mergedOptions,
      baseRewardConfig: resolveRewardConfig(mergedOptions),
    })
  }
}
