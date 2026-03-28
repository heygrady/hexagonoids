import { TrainLikeCommand } from '../../command-base/train-like-command.js'
import { inspectFitnessFlags } from '../../command-base/shared-flags.js'
import {
  defaultInspectFitnessOptions,
  runInspectFitness,
} from '../../features/inspect/inspectFitness.js'

export default class InspectFitnessCommand extends TrainLikeCommand {
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
    const profileRef =
      typeof flags.profile === 'string' ? flags.profile : undefined
    const profile = await this.resolveProfile(profileRef)
    const mergedOptions = this.mergeTrainOptions(
      this.profileToTrainOptions(profile),
      this.flagsToTrainOptions(flags)
    )

    this.logResolvedProfile(profile, mergedOptions)
    await runInspectFitness({
      scenariosPerOrganism:
        typeof flags.scenariosPerOrganism === 'number'
          ? flags.scenariosPerOrganism
          : (mergedOptions.scenariosPerOrganism ?? defaults.scenariosPerOrganism),
      scenarioMaxTicks:
        typeof flags.scenarioMaxTicks === 'number'
          ? flags.scenarioMaxTicks
          : (mergedOptions.scenarioMaxTicks ?? defaults.scenarioMaxTicks),
      seed: typeof flags.seed === 'string' ? flags.seed : defaults.seed,
      dtMs:
        typeof flags.dtMs === 'number'
          ? flags.dtMs
          : (mergedOptions.dtMs ?? defaults.dtMs),
      curriculumCount:
        typeof flags.curriculumCount === 'number'
          ? flags.curriculumCount
          : ((mergedOptions.curriculumCount as number | undefined) ??
            defaults.curriculumCount),
      scenarioWeight:
        typeof flags.scenarioWeight === 'number'
          ? flags.scenarioWeight
          : (mergedOptions.scenarioWeight ?? defaults.scenarioWeight),
      fullGameWeight:
        typeof flags.fullGameWeight === 'number'
          ? flags.fullGameWeight
          : (mergedOptions.fullGameWeight ?? defaults.fullGameWeight),
      curriculumWeight:
        typeof flags.curriculumWeight === 'number'
          ? flags.curriculumWeight
          : (mergedOptions.curriculumWeight ?? defaults.curriculumWeight),
      maxTicks:
        typeof flags.maxTicks === 'number'
          ? flags.maxTicks
          : (mergedOptions.maxTicks ?? defaults.maxTicks),
      fullGameSeeds:
        typeof flags.fullGameSeeds === 'number'
          ? flags.fullGameSeeds
          : (mergedOptions.fullGameSeedsPerOrganism ?? defaults.fullGameSeeds),
      genome: typeof flags.genome === 'string' ? flags.genome : undefined,
      lab: typeof flags.lab === 'string' ? flags.lab : undefined,
      method:
        typeof flags.method === 'string'
          ? flags.method
          : ((mergedOptions.method as string | undefined) ?? defaults.method),
      showRewardTotals: flags.showRewardTotals === true,
      profileConfig: mergedOptions,
    })
  }
}
