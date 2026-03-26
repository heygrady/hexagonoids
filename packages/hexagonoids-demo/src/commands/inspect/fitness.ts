import { BaseCommand } from '../../command-base/base-command.js'
import { inspectFitnessFlags } from '../../command-base/shared-flags.js'
import {
  defaultInspectFitnessOptions,
  runInspectFitness,
} from '../../features/inspect/inspectFitness.js'

export default class InspectFitnessCommand extends BaseCommand {
  static override summary = 'Inspect the fitness-scoring workflow.'

  static override description =
    'Runs scenario and full-game evaluations with scoring diagnostics for genomes, lab artifacts, and baseline agents.'

  static override examples = [
    '<%= config.bin %> inspect fitness --genome ./genome.json --seed debug-1',
  ]

  static override flags = {
    ...inspectFitnessFlags,
  }

  override async run(): Promise<void> {
    const { flags } = await this.parse(InspectFitnessCommand)
    const defaults = defaultInspectFitnessOptions()

    await runInspectFitness({
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
    })
  }
}
