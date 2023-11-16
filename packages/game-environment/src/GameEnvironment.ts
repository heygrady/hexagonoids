import type {
  Environment,
  EnvironmentDescription,
} from '@neat-evolution/environment'
import type { Executor, SyncExecutor } from '@neat-evolution/executor'

import type { GameData } from './GameData.js'
import type { GameEnvironmentOptions } from './GameEnvironmentOptions.js'
import type { GameExecutor } from './GameExecutor.js'

export class GameEnvironment<
  E extends SyncExecutor[],
  EA extends Executor[],
  GD extends GameData,
> implements Environment<GameEnvironmentOptions, E, EA, GD>
{
  public readonly description: EnvironmentDescription
  public readonly gameExecutor: GameExecutor<any, E, EA, GD>

  constructor(options: GameEnvironmentOptions) {
    this.description = options.description
    this.gameExecutor = options.gameExecutor
  }

  evaluate(...executors: E): GD {
    if (executors.length < Math.max(1, this.gameExecutor.playerSize)) {
      throw new Error(
        `executors.length (${executors.length}) must be greater than ${Math.max(
          1,
          this.gameExecutor.playerSize
        )}`
      )
    }
    if (executors.length > this.gameExecutor.playerSize) {
      throw new Error(
        `executors.length (${executors.length}) must be less than or equal to ${this.gameExecutor.playerSize}`
      )
    }
    const gameData = this.gameExecutor.play(executors)
    return gameData
  }

  async evaluateAsync(...executors: EA): Promise<GD> {
    if (executors.length < Math.max(1, this.gameExecutor.playerSize)) {
      throw new Error(
        `executors.length (${executors.length}) must be greater than ${Math.max(
          1,
          this.gameExecutor.playerSize
        )}`
      )
    }
    if (executors.length > this.gameExecutor.playerSize) {
      throw new Error(
        `executors.length (${executors.length}) must be less than or equal to ${this.gameExecutor.playerSize}`
      )
    }
    const gameData = await this.gameExecutor.playAsync(executors)
    return gameData
  }

  toFactoryOptions(): GameEnvironmentOptions {
    return {
      description: this.description,
      gameExecutor: this.gameExecutor,
    }
  }
}
