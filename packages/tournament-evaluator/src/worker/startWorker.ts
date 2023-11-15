import type {
  ActionMessage,
  HandleInitGenomeFn,
} from '@neat-evolution/worker-evaluator'
import { workerContext } from '@neat-evolution/worker-threads'

import {
  ActionType,
  createWorkerAction,
  type PayloadMap,
} from '../WorkerAction.js'

import {
  genomeCache,
  type HandleEvaluateMatchFn,
} from './handleEvaluateMatch.js'
import { type HandleInitEvaluatorFn } from './handleInitEvaluator.js'
import type { ThreadContext } from './ThreadContext.js'

async function handleTerminate() {
  console.debug('Terminating worker')
}

function handleError(error: Error) {
  console.error('Error in worker:', error)
}

function handleClearGenomeCache() {
  if (workerContext == null) {
    throw new Error('Worker must be created with a parent port')
  }
  genomeCache.clear()
  workerContext.postMessage(
    createWorkerAction(ActionType.RESPOND_CLEAR_GENOME_CACHE, null)
  )
}

export interface WorkerHandlers {
  handleInitEvaluator: HandleInitEvaluatorFn
  handleInitGenomeFactory: HandleInitGenomeFn
  handleEvaluateMatch: HandleEvaluateMatchFn
}

export const startWorker = ({
  handleInitEvaluator,
  handleInitGenomeFactory,
  handleEvaluateMatch,
}: WorkerHandlers) => {
  const threadContext: ThreadContext = {}

  if (workerContext !== null) {
    workerContext.addEventListener(
      'message',
      (action: ActionMessage<string, any>) => {
        switch (action.type) {
          case ActionType.INIT_EVALUATOR: {
            handleInitEvaluator(
              action.payload as PayloadMap[ActionType.INIT_EVALUATOR],
              threadContext
            ).catch(handleError)
            break
          }
          case ActionType.INIT_GENOME_FACTORY: {
            handleInitGenomeFactory(
              action.payload as PayloadMap[ActionType.INIT_GENOME_FACTORY],
              threadContext
            ).catch(handleError)
            break
          }

          case ActionType.REQUEST_CLEAR_GENOME_CACHE: {
            handleClearGenomeCache()
            break
          }
          case ActionType.REQUEST_EVALUATE_MATCH: {
            handleEvaluateMatch(
              action.payload as PayloadMap[ActionType.REQUEST_EVALUATE_MATCH],
              threadContext
            ).catch(handleError)
            break
          }
          case ActionType.TERMINATE: {
            handleTerminate().catch(handleError)
            break
          }
          default: {
            console.error(`Unknown action type: ${action.type}`)
          }
        }
      }
    )
  }
}
