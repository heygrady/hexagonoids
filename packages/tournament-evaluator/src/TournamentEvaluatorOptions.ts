import type { GameExecutor } from '@heygrady/game-environment'

export interface TournamentEvaluatorOptions {
  /** path to module that exports createExecutor */
  createExecutorPathname: string
  /** gameExecutor */
  gameExecutor: GameExecutor<any, any, any, any>
  /** Population.size */
  taskCount: number
  /** os.cpus() */
  threadCount: number
}
