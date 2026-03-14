import { formatNumber } from '../command-base/output.js'
import { trainLikeFlags } from '../command-base/shared-flags.js'
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
  }
}
