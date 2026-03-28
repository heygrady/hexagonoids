import { Flags } from '@oclif/core'
import { trainLikeFlags } from '../../command-base/shared-flags.js'
import { TrainLikeCommand } from '../../command-base/train-like-command.js'
import { runRewardValidation } from '../../features/inspect/rewardScreen.js'
import { resolveRewardConfig } from '../../features/runtime/buildEnvironmentOptions.js'

function parseCsv(value: string | undefined): string[] | undefined {
  if (value == null || value.trim().length === 0) return undefined
  return value
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
}

export default class InspectValidateCommand extends TrainLikeCommand {
  static override summary =
    'Run the longer reward-validation comparison across fixed seeds.'

  static override description =
    'Runs 15-generation-style validation comparing vanilla, A2C, and PPO across fixed seeds for the selected reward candidates and prints a recommendation. When --candidates is omitted, the command first shortlists the top candidates with a compact pre-screen.'

  static override examples = [
    '<%= config.bin %> inspect validate --profile default',
    '<%= config.bin %> inspect validate --iterations 15 --populationSize 32 --seeds s1,s2,s3 --candidates access-first',
  ]

  static override flags = {
    profile: trainLikeFlags.profile,
    seed: Flags.string({ summary: 'Base seed prefix for validation runs' }),
    method: Flags.string({ summary: 'Algorithm method (e.g. HyperNEAT)' }),
    iterations: Flags.integer({
      summary: 'Iterations per validation run',
      min: 1,
      default: 15,
    }),
    populationSize: Flags.integer({
      summary: 'Population size per validation run',
      min: 5,
      default: 32,
    }),
    seeds: Flags.string({
      summary: 'Comma-separated fixed validation seeds',
      default: 'seed-a,seed-b,seed-c',
    }),
    candidates: Flags.string({
      summary: 'Comma-separated candidate labels to validate',
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
    const { flags } = await this.parse(InspectValidateCommand)
    const profileRef =
      typeof flags.profile === 'string' ? flags.profile : undefined
    const profile = await this.resolveProfile(profileRef)
    const mergedOptions = this.mergeTrainOptions(
      this.profileToTrainOptions(profile),
      this.flagsToTrainOptions(flags)
    )

    this.logResolvedProfile(profile, mergedOptions)
    await runRewardValidation({
      seed:
        typeof flags.seed === 'string' ? flags.seed : 'reward-validate-001',
      method:
        typeof flags.method === 'string'
          ? flags.method
          : ((mergedOptions.method as string | undefined) ?? 'HyperNEAT'),
      iterations: flags.iterations,
      populationSize: flags.populationSize,
      seeds: parseCsv(flags.seeds) ?? ['seed-a', 'seed-b', 'seed-c'],
      candidateLabels: parseCsv(flags.candidates),
      profileConfig: mergedOptions,
      baseRewardConfig: resolveRewardConfig(mergedOptions),
    })
  }
}
