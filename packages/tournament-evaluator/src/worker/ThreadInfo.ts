import type { GameEnvironment, GameExecutor } from '@heygrady/game-environment'
import type {
  ConfigFactory,
  PhenotypeFactory,
  StateFactory,
} from '@neat-evolution/core'
import type {
  Executor,
  ExecutorFactory,
  SyncExecutor,
} from '@neat-evolution/executor'
import type { AnyGenomeFactory } from '@neat-evolution/worker-evaluator'

export interface ThreadInfo {
  createConfig: ConfigFactory<any, any, any, any, any>
  createExecutor: ExecutorFactory
  createGenome: AnyGenomeFactory
  createPhenotype: PhenotypeFactory<any>
  createState: StateFactory<any, any, any, any, any, any>
  environment: GameEnvironment<SyncExecutor[], Executor[], any>
  gameExecutor: GameExecutor<any, SyncExecutor[], Executor[], any>
}
