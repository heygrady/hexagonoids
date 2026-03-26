import { DEFAULT_REWARD_CONFIG } from '@heygrady/hexagonoids-environment'
import { Flags } from '@oclif/core'
import { BaseCommand } from '../../command-base/base-command.js'
import {
  defaultInspectRewardsOptions,
  runInspectRewards,
} from '../../features/inspect/inspectStepRewards.js'

export default class InspectRewardsCommand extends BaseCommand {
  static override summary =
    'Inspect reward-fitness correlation during training.'

  static override description =
    'Runs a training loop and reports per-generation Pearson correlation between fitness and total RL reward.'

  static override examples = [
    '<%= config.bin %> inspect rewards',
    '<%= config.bin %> inspect rewards --bulletAimReward 1.0 --bulletMissDemerit 0.5',
  ]

  static override flags = {
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
    deathPenalty: Flags.string({
      summary: 'Penalty per death (negative number)',
    }),
    bulletAimReward: Flags.string({
      summary: 'Fire-time reward coefficient for bullet intercept quality',
    }),
    bulletMissDemerit: Flags.string({
      summary: 'Penalty for bullets fired at nothing',
    }),
    thrustReward: Flags.string({
      summary: 'Small reward per tick when thrust is active',
    }),
  }

  override async run(): Promise<void> {
    const { flags } = await this.parse(InspectRewardsCommand)
    const defaults = defaultInspectRewardsOptions()

    const rewardConfig = { ...DEFAULT_REWARD_CONFIG }
    if (flags.deathPenalty != null)
      rewardConfig.deathPenalty = Number(flags.deathPenalty)
    if (flags.bulletAimReward != null)
      rewardConfig.bulletAimReward = Number(flags.bulletAimReward)
    if (flags.bulletMissDemerit != null)
      rewardConfig.bulletMissDemerit = Number(flags.bulletMissDemerit)
    if (flags.thrustReward != null)
      rewardConfig.thrustReward = Number(flags.thrustReward)

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
      rewardConfig,
    })
  }
}
