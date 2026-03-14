import { BaseCommand } from '../../command-base/base-command.js'
import { inspectInputsFlags } from '../../command-base/shared-flags.js'
import {
  DEFAULT_INSPECT_INPUTS_OPTIONS,
  runInspectInputs,
} from '../../features/inspect/inspectInputs.js'

export default class InspectInputsCommand extends BaseCommand {
  static override summary = 'Inspect the input-encoding workflow.'

  static override description =
    'Runs the production input encoder across scenario snapshots and summarizes per-channel statistics.'

  static override examples = [
    '<%= config.bin %> inspect inputs --seed debug-1 --agent random',
  ]

  static override flags = {
    ...inspectInputsFlags,
  }

  override async run(): Promise<void> {
    const { flags } = await this.parse(InspectInputsCommand)
    await runInspectInputs({
      scenariosPerRun:
        typeof flags.scenariosPerRun === 'number'
          ? flags.scenariosPerRun
          : DEFAULT_INSPECT_INPUTS_OPTIONS.scenariosPerRun,
      scenarioMaxTicks:
        typeof flags.scenarioMaxTicks === 'number'
          ? flags.scenarioMaxTicks
          : DEFAULT_INSPECT_INPUTS_OPTIONS.scenarioMaxTicks,
      seed:
        typeof flags.seed === 'string'
          ? flags.seed
          : DEFAULT_INSPECT_INPUTS_OPTIONS.seed,
      agent: flags.agent ?? DEFAULT_INSPECT_INPUTS_OPTIONS.agent,
      dtMs:
        typeof flags.dtMs === 'number'
          ? flags.dtMs
          : DEFAULT_INSPECT_INPUTS_OPTIONS.dtMs,
      verbose: flags.verbose ?? DEFAULT_INSPECT_INPUTS_OPTIONS.verbose,
    })
  }
}
