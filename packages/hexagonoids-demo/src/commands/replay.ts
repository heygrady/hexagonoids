import { Args } from '@oclif/core'
import { BaseCommand } from '../command-base/base-command.js'
import { formatNumber } from '../command-base/output.js'
import { replayFlags } from '../command-base/shared-flags.js'
import {
  DEFAULT_REPLAY_OPTIONS,
  replayGenome,
} from '../features/training/replayGenome.js'

export default class ReplayCommand extends BaseCommand {
  static override summary = 'Replay a saved genome artifact.'

  static override description =
    'Runs the legacy replay feature through the normalized oclif command surface. The command wiring is current, but the underlying replay behavior may still fail if old feature assumptions no longer hold.'

  static override examples = [
    '<%= config.bin %> replay ./path/to/genome.json --method NEAT --seed replay-1',
  ]

  static override args = {
    genome: Args.string({
      description: 'Path to the saved genome JSON file',
      required: true,
    }),
  }

  static override flags = {
    ...replayFlags,
  }

  override async run(): Promise<void> {
    const { args, flags } = await this.parse(ReplayCommand)
    const result = await replayGenome({
      pathname: args.genome,
      method: flags.method ?? DEFAULT_REPLAY_OPTIONS.method,
      seed:
        typeof flags.seed === 'string'
          ? flags.seed
          : DEFAULT_REPLAY_OPTIONS.seed,
      maxTicks:
        typeof flags.maxTicks === 'number'
          ? flags.maxTicks
          : DEFAULT_REPLAY_OPTIONS.maxTicks,
      dtMs:
        typeof flags.dtMs === 'number'
          ? flags.dtMs
          : DEFAULT_REPLAY_OPTIONS.dtMs,
      useFastThrust:
        flags.thrustMath === 'quaternion'
          ? false
          : DEFAULT_REPLAY_OPTIONS.useFastThrust,
    })

    this.log(`Replay completed for ${result.method}`)
    this.log(`Genome: ${result.pathname}`)
    this.log(`Seed: ${result.seed}`)
    this.log(`Fitness: ${formatNumber(result.fitness)}`)
    this.log(`Score: ${formatNumber(result.score)}`)
    this.log(`Rocks Destroyed: ${formatNumber(result.rocksDestroyed)}`)
    this.log(`Accuracy: ${formatNumber(result.accuracy)}`)
    this.log(`Time Alive: ${formatNumber(result.timeAlive)}`)
  }
}
