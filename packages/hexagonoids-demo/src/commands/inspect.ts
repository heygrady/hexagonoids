import { BaseCommand } from '../command-base/base-command.js'

export default class InspectCommand extends BaseCommand {
  static override summary = 'Run the inspection workflows.'

  static override description =
    'Use one of the inspect subcommands to analyze inputs or fitness scoring.'

  override async run(): Promise<void> {
    await this.config.runCommand('inspect inputs', ['--help'])
  }
}
