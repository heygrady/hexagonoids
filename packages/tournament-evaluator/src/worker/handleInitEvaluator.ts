import { workerContext } from '@neat-evolution/worker-threads'

import {
  ActionType,
  createWorkerAction,
  type InitEvaluatorPayload,
} from '../WorkerAction.js'

import type { ThreadContext } from './ThreadContext.js'

export type HandleInitEvaluatorFn = (
  payload: InitEvaluatorPayload,
  threadContext: ThreadContext
) => Promise<void>

// interface AlgorithmModule {
//   createGenome: () => Genome;
//   createPhenotype: () => Phenotype;
//   createState: () => State;
// }

// interface EnvironmentModule {
//   createEnvironment: () => Environment;
// }

// interface ExecutorModule {
//   createExecutor: () => Executor;
// }

// interface GameExecutorModule {
//   gameExecutor: () => GameExecutor;
// }

export const handleInitEvaluator: HandleInitEvaluatorFn = async (
  {
    algorithmPathname,
    createEnvironmentPathname,
    createExecutorPathname,
    gameExecutorPathname,
    environmentFactoryOptions,
  },
  threadContext
) => {
  // FIXME: improve type assertions here: AlgorithmModule, GameEnvironmentModule, ExecutorModule, GameExecutorModule
  const { createConfig, createGenome, createPhenotype, createState } =
    await import(algorithmPathname)
  const { createEnvironment } = await import(createEnvironmentPathname)
  const { createExecutor } = await import(createExecutorPathname)
  const { createGameExecutor } = await import(gameExecutorPathname)

  const gameExecutor = createGameExecutor(
    environmentFactoryOptions.gameExecutorOptions
  )
  const environment = createEnvironment({
    ...environmentFactoryOptions,
    gameExecutor,
  })

  if (workerContext == null) {
    throw new Error('Worker must be created with a parent port')
  }
  threadContext.threadInfo = {
    createConfig,
    createExecutor,
    gameExecutor,
    createGenome,
    createPhenotype,
    createState,
    environment,
  }
  workerContext.postMessage(
    createWorkerAction(ActionType.INIT_EVALUATOR_SUCCESS, null)
  )
}
