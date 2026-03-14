import { formatNumber } from '../command-base/output.js'
import { trainLikeFlags } from '../command-base/shared-flags.js'
import { TrainLikeCommand } from '../command-base/train-like-command.js'
import { train } from '../features/training/train.js'

export default class TrainCommand extends TrainLikeCommand {
  static override summary = 'Run the evolution training workflow.'

  static override description =
    'Runs training with the normalized CLI surface and writes the resulting artifacts to the configured output directory.'

  static override examples = [
    '<%= config.bin %> train --method NEAT --profile default',
  ]

  static override flags = {
    ...trainLikeFlags,
  }

  override async run(): Promise<void> {
    const { flags } = await this.parse(TrainCommand)
    const profileRef =
      typeof flags.profile === 'string' ? flags.profile : undefined
    const profile = await this.resolveProfile(profileRef)
    const options = this.mergeTrainOptions(
      profile.config,
      this.flagsToTrainOptions(flags),
      { baselineOnly: false }
    )

    this.log(`Using profile: ${profile.label}`)
    const result = await train(options)
    if (result.mode !== 'training') {
      this.error('Expected training mode result.')
    }

    this.log(`Mode: training`)
    this.log(`Method: ${result.method}`)
    this.log(`Best Fitness: ${formatNumber(result.bestFitness)}`)
    if (result.populationFitnessMean != null) {
      this.log(`Population Mean: ${formatNumber(result.populationFitnessMean)}`)
    }
    if (result.populationFitnessMedian != null) {
      this.log(
        `Population Median: ${formatNumber(result.populationFitnessMedian)}`
      )
    }
    this.log(`Best File: ${result.bestFilePath}`)
    this.log(`Generations Log: ${result.generationsLogPath}`)
  }
}
