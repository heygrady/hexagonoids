import { Flags } from '@oclif/core'

import { trainLikeFlags } from '../command-base/shared-flags.js'
import { TrainLikeCommand } from '../command-base/train-like-command.js'
import { runLab } from '../features/lab/runLab.js'

export default class LabCommand extends TrainLikeCommand {
  static override summary =
    'Run the lab workflow and analyze the resulting genomes.'

  static override description =
    'Runs a short training pass, analyzes the generated genomes, and writes a lab report without relying on any legacy CLI shorthand.'

  static override examples = [
    '<%= config.bin %> lab --method NEAT --name smoke-test --profile default',
  ]

  static override flags = {
    ...trainLikeFlags,
    name: Flags.string({
      summary: 'Experiment name prefix',
    }),
    analysisSeedsPerGenome: Flags.integer({
      min: 1,
      summary: 'Seeds per genome during analysis',
    }),
    analysisMaxTicks: Flags.integer({
      min: 1,
      summary: 'Maximum ticks per analysis game',
    }),
  }

  override async run(): Promise<void> {
    const { flags } = await this.parse(LabCommand)
    const trainOptions = this.flagsToTrainOptions(flags)
    const profilePath =
      typeof flags.profile === 'string' ? flags.profile : undefined

    await runLab({
      ...trainOptions,
      ...(typeof flags.name === 'string' && { name: flags.name }),
      ...(typeof flags.analysisSeedsPerGenome === 'number' && {
        analysisSeedsPerGenome: flags.analysisSeedsPerGenome,
      }),
      ...(typeof flags.analysisMaxTicks === 'number' && {
        analysisMaxTicks: flags.analysisMaxTicks,
      }),
      ...(profilePath != null && { profilePath }),
    })
  }
}
