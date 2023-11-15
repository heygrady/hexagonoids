import type { GameData, GameEnvironment } from '@heygrady/game-environment'
import { type AnyAlgorithm } from '@neat-evolution/evaluator'
import type { Executor, SyncExecutor } from '@neat-evolution/executor'

import { TournamentEvaluator } from './TournamentEvaluator.js'
import type { TournamentEvaluatorOptions } from './TournamentEvaluatorOptions.js'

export const createEvaluator = <
  E extends SyncExecutor[],
  EA extends Executor[],
  GD extends GameData,
>(
  algorithm: AnyAlgorithm,
  environment: GameEnvironment<E, EA, GD>,
  options: TournamentEvaluatorOptions
) => {
  return new TournamentEvaluator<E, EA, GD>(algorithm, environment, options)
}
