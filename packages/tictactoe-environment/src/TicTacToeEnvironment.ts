import type {
  Environment,
  EnvironmentDescription,
} from '@neat-evolution/environment'
import type { Executor, SyncExecutor } from '@neat-evolution/executor'
import type { RNG } from '@neat-evolution/utils'

import { evaluateGauntlet } from './evaluation/gauntletEvaluation.js'
import { playMatch } from './evaluation/playMatch.js'
import {
  mergeConfig,
  type TicTacToeEnvironmentConfig,
} from './TicTacToeEnvironmentConfig.js'
import { calculateNormalizationBounds } from './types/scoring.js'
import { createPlayerFromExecutor } from './utils/createPlayerFromExecutor.js'

/**
 * Wraps a SyncExecutor in the PlayerFn interface.
 * This binds the executor to the neatAI function and adapts its
 * return type from [Board, number, number] to [Board, number].
 * @param {SyncExecutor} executor - The SyncExecutor to wrap
 * @returns {import('@heygrady/tictactoe-game').PlayerFn} A PlayerFn that uses the provided executor
 */

export class TicTacToeEnvironment
  implements Environment<TicTacToeEnvironmentConfig>
{
  public readonly description: EnvironmentDescription
  public readonly isAsync = false
  private readonly config: TicTacToeEnvironmentConfig

  constructor(config?: Partial<TicTacToeEnvironmentConfig>) {
    this.config = mergeConfig(config)
    this.description = {
      inputs: 18, // 9 squares for player's pieces, 9 for opponent's
      outputs: 9, // 9 possible moves
    }
  }

  /**
   * Evaluates a single head-to-head match (the executors) provided by the EvaluationStrategy.
   * @param {SyncExecutor[]} executors - A list of executors for a *single match*. This environment assumes executors.length === 2.
   * @param {RNG} [rng] - Optional random number generator
   * @returns {number[]} Array of scores for each executor
   */
  evaluateBatch(executors: SyncExecutor[], rng?: RNG): number[] {
    // This environment only supports 2-player matches.
    // The EvaluationStrategy should be configured with matchPlayerSize = 2.
    if (executors.length !== 2) {
      throw new Error(
        `TicTacToeEnvironment evaluateBatch expects 2 executors (a single match), but received ${executors.length}. Ensure your EvaluationStrategy has matchPlayerSize = 2.`
      )
    }

    const [execA, execB] = executors as [SyncExecutor, SyncExecutor]

    const playerA = createPlayerFromExecutor(execA)
    const playerB = createPlayerFromExecutor(execB)

    const { positionWeights } = this.config
    const normalizationBounds = calculateNormalizationBounds(
      this.config.gameOutcomeScores,
      this.config.confidenceMultiplier
    )

    const result = playMatch(
      playerA,
      playerB,
      normalizationBounds,
      positionWeights,
      this.config.gameOutcomeScores,
      this.config.confidenceMultiplier,
      this.config.moveWeighting,
      { rng }
    )

    // Return scores in the *same order* as the executors were received.
    return [result.scoreA, result.scoreB]
  }

  /**
   * Evaluates a single genome against a gauntlet of built-in AI opponents.
   * Uses soft min-max normalization to scale scores to approximately 0-1 range
   * while allowing outliers to exceed bounds.
   * @param {SyncExecutor} executor - The executor to evaluate
   * @param {RNG} [rng] - Optional random number generator
   * @returns {number} Final weighted fitness score
   */
  evaluate(executor: SyncExecutor, rng?: RNG): number {
    const player = createPlayerFromExecutor(executor)

    return evaluateGauntlet(
      player,
      this.config.gauntletOpponents,
      this.config.positionWeights,
      this.config.gameOutcomeScores,
      this.config.confidenceMultiplier,
      this.config.moveWeighting,
      { rng }
    )
  }

  // Required methods from Environment interface
  close() {
    return undefined
  }

  async evaluateAsync(_executor: Executor): Promise<number> {
    throw new Error(
      'evaluateAsync is not implemented for this synchronous environment.'
    )
  }

  async evaluateBatchAsync(_executors: Executor[]): Promise<number[]> {
    throw new Error(
      'evaluateBatchAsync is not implemented for this synchronous environment.'
    )
  }

  toFactoryOptions(): TicTacToeEnvironmentConfig {
    return this.config
  }
}
