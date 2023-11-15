import {
  type GameData,
  type GameEnvironment,
  type GameExecutor,
} from '@heygrady/game-environment'
import {
  type ConfigData,
  type GenomeOptions,
  type InitConfig,
} from '@neat-evolution/core'
import {
  type FitnessData,
  type GenomeEntries,
  type AnyAlgorithm,
  type Evaluator,
} from '@neat-evolution/evaluator'
import type { Executor, SyncExecutor } from '@neat-evolution/executor'
import type { ActionMessage } from '@neat-evolution/worker-evaluator'
import { Worker } from '@neat-evolution/worker-threads'
import { Sema } from 'async-sema'

import { runSwissTournament } from './tournament/runSwissTournament.js'
import { toPlayers } from './tournament/toPlayers.js'
import type { Player, PlayerScore } from './tournament/types.js'
import type { TournamentEvaluatorOptions } from './TournamentEvaluatorOptions.js'
import {
  ActionType,
  createWorkerAction,
  type InitEvaluatorPayload,
  type PayloadMap,
  type RequestMapValue,
} from './WorkerAction.js'

export class TournamentEvaluator<
  E extends SyncExecutor[],
  EA extends Executor[],
  GD extends GameData,
> implements Evaluator<E, EA, GameData>
{
  public readonly algorithm: AnyAlgorithm
  public readonly environment: GameEnvironment<E, EA, GD>
  public readonly gameExecutor: GameExecutor<any, E, EA, GD>

  public readonly taskCount: number
  public readonly threadCount: number
  public readonly createExecutorPathname: string
  public readonly createEnvironmentPathname: string
  public readonly initPromise: Promise<void>

  private readonly workers: Worker[]
  private readonly semaphore: Sema
  private readonly requestMap = new Map<Worker, RequestMapValue<any>>()

  constructor(
    algorithm: AnyAlgorithm,
    environment: GameEnvironment<E, EA, GD>,
    options: TournamentEvaluatorOptions
  ) {
    this.algorithm = algorithm
    this.environment = environment
    this.gameExecutor = options.gameExecutor

    this.taskCount = options.taskCount
    this.threadCount = options.threadCount
    this.createExecutorPathname = options.createExecutorPathname
    this.createEnvironmentPathname = '@heygrady/game-environment'

    this.semaphore = new Sema(options.threadCount, {
      capacity: options.taskCount,
    })

    this.workers = []
    this.requestMap = new Map()
    this.initPromise = this.initWorkers()
  }

  async initWorkers() {
    const initPromises: Array<Promise<void>> = []

    for (let i = 0; i < this.threadCount; i++) {
      const initPromise = new Promise<void>((resolve, reject) => {
        const worker = new Worker(
          new URL('./tournamentWorkerScript.js', import.meta.url),
          {
            name: `TournamentEvaluator-${i}`,
          }
        )
        const messageListener = (action: ActionMessage<string, any>) => {
          switch (action.type) {
            case ActionType.RESPOND_EVALUATE_MATCH: {
              const payload =
                action.payload as PayloadMap['RESPOND_EVALUATE_MATCH']
              const { resolve } = this.requestMap.get(worker) ?? {}
              if (resolve == null) {
                throw new Error('no request found')
              }
              resolve(payload)
              break
            }
            case ActionType.INIT_EVALUATOR_SUCCESS: {
              resolve()
              this.workers.push(worker)
              break
            }
            case ActionType.INIT_GENOME_FACTORY_SUCCESS: {
              break
            }
            case ActionType.RESPOND_CLEAR_GENOME_CACHE: {
              const { resolve } = this.requestMap.get(worker) ?? {}
              if (resolve == null) {
                throw new Error('no request found')
              }
              resolve(null)
              break
            }
            default: {
              const { reject: rejectRequest } =
                this.requestMap.get(worker) ?? {}
              const error = new Error(
                `Unexpected action type: no handler for ${action.type}`
              )
              if (rejectRequest != null) {
                rejectRequest(error)
              } else {
                reject(error)
              }
              break
            }
          }
        }

        const errorListener = (error: Error) => {
          const { reject: rejectRequest } = this.requestMap.get(worker) ?? {}
          if (rejectRequest != null) {
            rejectRequest(error)
          } else {
            reject(error)
          }
        }

        worker.addEventListener('message', messageListener)
        worker.addEventListener('error', errorListener)

        const gameEnvironmentOptions = this.environment.toFactoryOptions()
        const data: InitEvaluatorPayload = {
          algorithmPathname: this.algorithm.pathname,
          createExecutorPathname: this.createExecutorPathname,
          createEnvironmentPathname: this.createEnvironmentPathname,
          gameExecutorPathname: this.gameExecutor.pathname,
          environmentFactoryOptions: {
            description: gameEnvironmentOptions.description,
            gameExecutorOptions: this.gameExecutor.options,
          },
        }

        worker.postMessage(createWorkerAction(ActionType.INIT_EVALUATOR, data))
      })

      initPromises.push(initPromise)
    }
    await Promise.all(initPromises)
  }

  async initGenomeFactory<CD extends ConfigData>(
    configData: CD,
    genomeOptions: GenomeOptions,
    initConfig: InitConfig
  ) {
    await this.initPromise
    for (const worker of this.workers) {
      worker.postMessage(
        createWorkerAction(ActionType.INIT_GENOME_FACTORY, {
          configData,
          genomeOptions,
          initConfig,
        })
      )
    }
  }

  async terminate() {
    const terminatePromises: Array<Promise<void>> = []
    for (const worker of this.workers) {
      worker.postMessage(createWorkerAction(ActionType.TERMINATE, null))
      terminatePromises.push(worker.terminate())
    }
    await Promise.all(terminatePromises)
  }

  async *evaluate(
    genomeEntries: GenomeEntries<any>
  ): AsyncIterable<FitnessData> {
    await this.initPromise
    await this.clearGenomeCache()

    const players = toPlayers(genomeEntries)

    const evaluateMatch = this.evaluateMatch.bind(this)

    const fitnessEntries = await runSwissTournament(
      players,
      this.gameExecutor,
      evaluateMatch
    )

    yield* fitnessEntries
  }

  private async clearGenomeCache() {
    await this.initPromise

    if (this.workers.length < this.threadCount) {
      throw new Error(
        `Some workers are busy; expected ${this.threadCount} workers but got ${this.workers.length}`
      )
    }

    const promises: Array<Promise<any>> = []
    for (const worker of this.workers) {
      promises.push(
        new Promise((resolve, reject) => {
          const customResolve = (
            value: PlayerScore[] | PromiseLike<PlayerScore[]>
          ) => {
            this.requestMap.delete(worker)
            resolve(value)
          }
          this.requestMap.set(worker, { resolve: customResolve, reject })

          // Post data to the worker
          worker.postMessage(
            createWorkerAction(ActionType.REQUEST_CLEAR_GENOME_CACHE, null)
          )
        })
      )
    }
    await Promise.all(promises)
  }

  private async evaluateMatch(players: Player[]): Promise<PlayerScore[]> {
    await this.initPromise
    await this.semaphore.acquire()
    const worker = this.workers.pop()

    if (worker == null) {
      this.semaphore.release()
      throw new Error('No worker available')
    }

    let scores: PlayerScore[]

    try {
      scores = await this.requestEvaluateMatch(worker, players)
    } finally {
      this.semaphore.release()
      this.workers.push(worker)
    }
    return scores
  }

  private async requestEvaluateMatch(
    worker: Worker,
    players: Player[]
  ): Promise<PlayerScore[]> {
    return await new Promise((resolve, reject) => {
      const customResolve = (
        value: PlayerScore[] | PromiseLike<PlayerScore[]>
      ) => {
        this.requestMap.delete(worker)
        resolve(value)
      }
      this.requestMap.set(worker, { resolve: customResolve, reject })

      // Post data to the worker
      worker.postMessage(
        createWorkerAction(ActionType.REQUEST_EVALUATE_MATCH, players)
      )
    })
  }
}
