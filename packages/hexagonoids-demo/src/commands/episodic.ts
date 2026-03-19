import { Flags } from '@oclif/core'

import { BaseCommand } from '../command-base/base-command.js'
import { runEpisodic } from '../features/episodic/index.js'

export default class EpisodicCommand extends BaseCommand {
  static override summary = 'Run the episodic comparison workflow.'

  static override description =
    'Runs the Vanilla, AC-Lamarck, QL-Lamarck, A2C-Lamarck, DQL-Lamarck, and PPO-Lamarck comparison with a standard flag-only command surface.'

  static override examples = [
    '<%= config.bin %> episodic --iterations 20 --populationSize 64',
  ]

  static override flags = {
    iterations: Flags.integer({
      min: 1,
      summary: 'Training iterations per variant',
    }),
    maxTicks: Flags.integer({
      min: 1,
      summary: 'Maximum ticks per run',
    }),
    populationSize: Flags.integer({
      min: 1,
      summary: 'Population size',
    }),
    baseSeed: Flags.string({
      summary: 'Base seed for deterministic runs',
    }),
    threadCount: Flags.integer({
      min: 1,
      summary: 'Worker thread count',
    }),
  }

  override async run(): Promise<void> {
    const { flags } = await this.parse(EpisodicCommand)
    await runEpisodic({
      ...(typeof flags.iterations === 'number' && {
        iterations: flags.iterations,
      }),
      ...(typeof flags.maxTicks === 'number' && { maxTicks: flags.maxTicks }),
      ...(typeof flags.populationSize === 'number' && {
        populationSize: flags.populationSize,
      }),
      ...(typeof flags.baseSeed === 'string' && { baseSeed: flags.baseSeed }),
      ...(typeof flags.threadCount === 'number' && {
        threadCount: flags.threadCount,
      }),
    })
  }
}
