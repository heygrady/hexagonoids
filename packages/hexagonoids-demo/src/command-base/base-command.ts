import { Command } from '@oclif/core'

export abstract class BaseCommand extends Command {
  protected logLines(lines: string[]): void {
    for (const line of lines) {
      this.log(line)
    }
  }
}
