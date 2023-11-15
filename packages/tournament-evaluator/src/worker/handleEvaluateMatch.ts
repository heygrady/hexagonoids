import {
  isAsyncGameExecutor,
  type PlayerData,
} from '@heygrady/game-environment'
import type { GenomeFactoryOptions, Phenotype } from '@neat-evolution/core'
import type { AnyGenome } from '@neat-evolution/evaluator'
import {
  isAsyncExecutor,
  type Executor,
  type SyncExecutor,
} from '@neat-evolution/executor'
import { workerContext } from '@neat-evolution/worker-threads'
import QuickLRU from 'quick-lru'

import type { GenomeId } from '../tournament/GenomeId.js'
import type { PlayerScore } from '../tournament/types.js'
import { ActionType, createWorkerAction } from '../WorkerAction.js'

import type { ThreadContext } from './ThreadContext.js'

export interface GenomeCacheValue {
  genomeFactoryOptions: GenomeFactoryOptions<any, any>
  genome: AnyGenome<any>
  phenotype: Phenotype
  executor: Executor
}

/** MUST clear when genome factory is updated */
export const genomeCache = new QuickLRU<GenomeId, GenomeCacheValue>({
  /** default population size */
  maxSize: 100,
})

export type EvaluateMatchPayload = Array<
  [genomeId: string, genomeFactoryOptions: GenomeFactoryOptions<any, any>]
>

export type HandleEvaluateMatchFn = (
  payload: EvaluateMatchPayload,
  threadContext: ThreadContext
) => Promise<void>

const executorMap = new WeakMap<Executor, GenomeId>()
export const handleEvaluateMatch = async (
  payload: EvaluateMatchPayload,
  threadContext: ThreadContext
) => {
  if (threadContext.threadInfo == null) {
    throw new Error('threadInfo not initialized')
  }
  if (threadContext.genomeFactoryConfig == null) {
    throw new Error('genomeFactoryConfig not initialized')
  }
  if (workerContext == null) {
    throw new Error('Worker must be created with a parent port')
  }

  // hydrate the genomes
  const { configProvider, stateProvider, genomeOptions, initConfig } =
    threadContext.genomeFactoryConfig
  const executors: Executor[] = []

  const {
    createGenome,
    createPhenotype,
    createExecutor,
    gameExecutor,
    environment,
  } = threadContext.threadInfo

  let hasAsyncExecutor = false
  for (const [genomeId, genomeFactoryOptions] of payload) {
    let cache = genomeCache.get(genomeId)
    if (cache == null) {
      const genome = createGenome(
        configProvider,
        stateProvider,
        genomeOptions,
        initConfig,
        genomeFactoryOptions
      )
      const phenotype = createPhenotype(genome)
      const executor = createExecutor(phenotype)
      cache = {
        genomeFactoryOptions,
        genome,
        phenotype,
        executor,
      }
      executorMap.set(executor, genomeId)
      genomeCache.set(genomeId, cache)
    }
    if (isAsyncExecutor(cache.executor)) {
      hasAsyncExecutor = true
    }
    executors.push(cache.executor)
  }

  // evaluate the genome
  let executorScores: PlayerData[]
  if (isAsyncGameExecutor(gameExecutor) || hasAsyncExecutor) {
    executorScores = await environment.evaluateAsync(...executors)
  } else {
    executorScores = environment.evaluate(...(executors as SyncExecutor[]))
  }
  const scores: PlayerScore[] = executorScores as unknown as PlayerScore[]
  for (const playerData of executorScores) {
    const genomeId = executorMap.get(playerData[0])
    if (genomeId == null) {
      throw new Error('genomeId not found')
    }
    const playerScore = playerData as unknown as PlayerScore
    playerScore[0] = genomeId
  }

  workerContext.postMessage(
    createWorkerAction(ActionType.RESPOND_EVALUATE_MATCH, scores)
  )
}
