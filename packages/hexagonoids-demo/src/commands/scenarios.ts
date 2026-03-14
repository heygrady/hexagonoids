import { BaseCommand } from '../command-base/base-command.js'
import { scenariosFlags } from '../command-base/shared-flags.js'
import { defaultScenarioOptions } from '../features/scenarios/options.js'
import { runGenerateScenarios } from '../features/scenarios/runGenerateScenarios.js'
import type { ScenarioOptions } from '../features/scenarios/types.js'

export default class ScenariosCommand extends BaseCommand {
  static override summary = 'Refresh the scenario-bank workflow.'

  static override description =
    'Generates and writes a refreshed scenario bank from trained agents using the normalized oclif command surface.'

  static override examples = [
    '<%= config.bin %> scenarios --output ./scenario-bank.json --seed scenario-refresh-1',
  ]

  static override flags = {
    ...scenariosFlags,
  }

  private toScenarioOptions(
    flags: Record<string, unknown>
  ): Partial<ScenarioOptions> {
    const defaults = defaultScenarioOptions()
    const options: Partial<ScenarioOptions> = {}

    if (typeof flags.labRoot === 'string') options.labRoot = flags.labRoot
    if (typeof flags['max-labs'] === 'number')
      options.maxLabs = flags['max-labs']
    if (typeof flags['hero-count'] === 'number') {
      options.heroCount = flags['hero-count']
    }
    if (typeof flags['count-per-source'] === 'number') {
      options.countPerSource = flags['count-per-source']
    }
    if (typeof flags['panel-max'] === 'number') {
      options.panelMax = flags['panel-max']
    }
    if (typeof flags['panel-scout-count'] === 'number') {
      options.panelScoutCount = flags['panel-scout-count']
    }
    if (typeof flags.rewind === 'number') options.rewind = flags.rewind
    if (typeof flags['max-games'] === 'number') {
      options.maxGames = flags['max-games']
    }
    if (typeof flags['eval-ticks'] === 'number') {
      options.evalTicks = flags['eval-ticks']
    }
    if (typeof flags['instant-death-trials'] === 'number') {
      options.instantDeathTrials = flags['instant-death-trials']
    }
    if (typeof flags['random-baseline-trials'] === 'number') {
      options.randomBaselineTrials = flags['random-baseline-trials']
    }
    if (typeof flags['final-count'] === 'number') {
      options.finalCount = flags['final-count']
    }
    if (typeof flags.seed === 'string') options.seed = flags.seed
    if (typeof flags.output === 'string') options.output = flags.output
    if (typeof flags.existing === 'string') options.existing = flags.existing
    if (flags['no-merge-existing'] === true) options.mergeExisting = false
    if (typeof flags.report === 'string') options.report = flags.report
    if (flags['dry-run'] === true) options.dryRun = true

    return {
      ...defaults,
      ...options,
    }
  }

  override async run(): Promise<void> {
    const { flags } = await this.parse(ScenariosCommand)
    await runGenerateScenarios(this.toScenarioOptions(flags))
  }
}
