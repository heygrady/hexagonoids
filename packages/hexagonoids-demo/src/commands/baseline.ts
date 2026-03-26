import { Flags } from '@oclif/core'

import { formatNumber } from '../command-base/output.js'
import { trainLikeFlags } from '../command-base/shared-flags.js'
import {
  defaultInspectFitnessOptions,
  runInspectFitness,
} from '../features/inspect/inspectFitness.js'
import { TrainLikeCommand } from '../command-base/train-like-command.js'
import { train } from '../features/training/train.js'

export default class BaselineCommand extends TrainLikeCommand {
  static override summary = 'Run the baseline-only evaluation workflow.'

  static override description =
    'Evaluates the built-in baseline agents with the standard training and scenario flags, without running evolution.'

  static override examples = [
    '<%= config.bin %> baseline --method NEAT --baseSeed seed-1',
  ]

  static override flags = {
    ...trainLikeFlags,
    inspectAlignment: Flags.boolean({
      summary:
        'After baseline evaluation, run fitness inspection with reward totals for built-in agents',
    }),
  }

  override async run(): Promise<void> {
    const { flags } = await this.parse(BaselineCommand)
    const profileRef =
      typeof flags.profile === 'string' ? flags.profile : undefined
    const profile = await this.resolveProfile(profileRef)
    const options = this.mergeTrainOptions(
      profile.config,
      this.flagsToTrainOptions(flags),
      { baselineOnly: true }
    )

    const result = await train(options)
    if (result.mode !== 'baseline') {
      this.error('Expected baseline mode result.')
    }

    this.log(`Mode: baseline`)
    this.log(`Method: ${result.method}`)
    this.log(`Profile: ${profile.label}`)
    this.log(`Seeds: ${result.seeds.length}`)
    for (const score of result.scores) {
      this.log(
        `${score.name}: meanFitness=${formatNumber(score.meanFitness)} score=${formatNumber(score.metrics.score)} accuracy=${formatNumber(score.metrics.accuracy)} rocks=${formatNumber(score.metrics.rocksDestroyed)}`
      )
    }

    if (flags.inspectAlignment === true) {
      const defaults = defaultInspectFitnessOptions()
      this.log()
      await runInspectFitness({
        scenariosPerOrganism:
          options.scenariosPerOrganism ?? defaults.scenariosPerOrganism,
        scenarioMaxTicks: options.scenarioMaxTicks ?? defaults.scenarioMaxTicks,
        seed: options.baseSeed ?? defaults.seed,
        dtMs: options.dtMs ?? defaults.dtMs,
        curriculumCount:
          (options.curriculumCount as number | undefined) ??
          defaults.curriculumCount,
        scenarioWeight: options.scenarioWeight ?? defaults.scenarioWeight,
        fullGameWeight: options.fullGameWeight ?? defaults.fullGameWeight,
        curriculumWeight: options.curriculumWeight ?? defaults.curriculumWeight,
        maxTicks: options.maxTicks ?? defaults.maxTicks,
        fullGameSeeds:
          options.fullGameSeedsPerOrganism ?? defaults.fullGameSeeds,
        genome: undefined,
        lab: undefined,
        method: (options.method as string | undefined) ?? defaults.method,
        showRewardTotals: true,
        discoverLabGenomes: false,
        profileConfig: options,
      })
    }
  }
}
