import { DEFAULT_REWARD_CONFIG } from '@heygrady/hexagonoids-environment'
import { Flags } from '@oclif/core'
import { BaseCommand } from '../../command-base/base-command.js'
import { inspectFitnessFlags } from '../../command-base/shared-flags.js'
import {
  defaultInspectRewardsOptions,
  runInspectRewards,
} from '../../features/inspect/inspectStepRewards.js'

export default class InspectRewardsCommand extends BaseCommand {
  static override summary = 'Inspect the reward signal for RL training.'

  static override description =
    'Runs evaluation and reports per-tick reward events, segment triggers, and alignment with fitness.'

  static override examples = [
    '<%= config.bin %> inspect rewards',
    '<%= config.bin %> inspect rewards --rockReward 2 --deathPenalty -0.5',
    '<%= config.bin %> inspect rewards --genome ./genome.json',
  ]

  static override flags = {
    ...inspectFitnessFlags,
    rockReward: Flags.string({
      summary: 'Reward per rock destroyed',
    }),
    deathPenalty: Flags.string({
      summary: 'Penalty per death (negative number)',
    }),
    survivalReward: Flags.string({
      summary: 'Reward per alive tick',
    }),
    scoreScale: Flags.string({
      summary: 'Multiplier for engine score delta',
    }),
    shotPenalty: Flags.string({
      summary: 'Penalty per bullet fired',
    }),
  }

  override async run(): Promise<void> {
    const { flags } = await this.parse(InspectRewardsCommand)
    const defaults = defaultInspectRewardsOptions()

    const rewardConfig = { ...DEFAULT_REWARD_CONFIG }
    if (flags.rockReward != null)
      rewardConfig.rockReward = Number(flags.rockReward)
    if (flags.deathPenalty != null)
      rewardConfig.deathPenalty = Number(flags.deathPenalty)
    if (flags.survivalReward != null)
      rewardConfig.survivalReward = Number(flags.survivalReward)
    if (flags.scoreScale != null)
      rewardConfig.scoreScale = Number(flags.scoreScale)
    if (flags.shotPenalty != null)
      rewardConfig.shotPenalty = Number(flags.shotPenalty)

    await runInspectRewards({
      scenariosPerOrganism:
        typeof flags.scenariosPerOrganism === 'number'
          ? flags.scenariosPerOrganism
          : defaults.scenariosPerOrganism,
      scenarioMaxTicks:
        typeof flags.scenarioMaxTicks === 'number'
          ? flags.scenarioMaxTicks
          : defaults.scenarioMaxTicks,
      seed: typeof flags.seed === 'string' ? flags.seed : defaults.seed,
      dtMs: typeof flags.dtMs === 'number' ? flags.dtMs : defaults.dtMs,
      curriculum: flags.curriculum ?? defaults.curriculum,
      curriculumCount:
        typeof flags.curriculumCount === 'number'
          ? flags.curriculumCount
          : defaults.curriculumCount,
      scenarioWeight:
        typeof flags.scenarioWeight === 'number'
          ? flags.scenarioWeight
          : defaults.scenarioWeight,
      fullGameWeight:
        typeof flags.fullGameWeight === 'number'
          ? flags.fullGameWeight
          : defaults.fullGameWeight,
      curriculumWeight:
        typeof flags.curriculumWeight === 'number'
          ? flags.curriculumWeight
          : defaults.curriculumWeight,
      maxTicks:
        typeof flags.maxTicks === 'number' ? flags.maxTicks : defaults.maxTicks,
      fullGameSeeds:
        typeof flags.fullGameSeeds === 'number'
          ? flags.fullGameSeeds
          : defaults.fullGameSeeds,
      genome: typeof flags.genome === 'string' ? flags.genome : undefined,
      lab: typeof flags.lab === 'string' ? flags.lab : undefined,
      method: typeof flags.method === 'string' ? flags.method : defaults.method,
      rewardConfig,
    })
  }
}
