import type {
  ConfigData,
  GenomeFactoryOptions,
  GenomeOptions,
  InitConfig,
} from '@neat-evolution/core'
import {
  createActionMessage,
  type ActionMessage,
} from '@neat-evolution/worker-evaluator'

import type { GenomeId } from './tournament/GenomeId.js'
import type { PlayerScore } from './tournament/types.js'

export interface RequestMapValue<V> {
  resolve: (value: V | PromiseLike<V>) => void
  reject: (reason?: any) => void
}

export enum ActionType {
  INIT_EVALUATOR = 'INIT_EVALUATOR',
  INIT_EVALUATOR_SUCCESS = 'INIT_EVALUATOR_SUCCESS',
  INIT_GENOME_FACTORY = 'INIT_GENOME_FACTORY',
  INIT_GENOME_FACTORY_SUCCESS = 'INIT_GENOME_FACTORY_SUCCESS',
  REQUEST_EVALUATE_MATCH = 'REQUEST_EVALUATE_MATCH',
  RESPOND_EVALUATE_MATCH = 'RESPOND_EVALUATE_MATCH',
  REQUEST_CLEAR_GENOME_CACHE = 'REQUEST_CLEAR_GENOME_CACHE',
  RESPOND_CLEAR_GENOME_CACHE = 'RESPOND_CLEAR_GENOME_CACHE',
  TERMINATE = 'TERMINATE',
}

export interface InitEvaluatorPayload {
  algorithmPathname: string
  createExecutorPathname: string
  createEnvironmentPathname: string
  gameExecutorPathname: string
  environmentFactoryOptions: {
    description: InitConfig
    gameExecutorOptions: any
  }
}

export interface InitGenomeFactoryPayload<
  CD extends ConfigData,
  GO extends GenomeOptions,
> {
  configData: CD
  genomeOptions: GO
  initConfig: InitConfig
}

export type InitEvaluatorAction = ActionMessage<
  InitEvaluatorPayload,
  ActionType.INIT_EVALUATOR
>

export type InitEvaluatorSuccessAction = ActionMessage<
  null,
  ActionType.INIT_EVALUATOR_SUCCESS
>

export type EvaluateMatchPayload = Array<
  [genomeId: GenomeId, genomeFactoryOptions: GenomeFactoryOptions<any, any>]
>

export type TerminateAction = ActionMessage<null, ActionType.TERMINATE>

export interface PayloadMap {
  [ActionType.INIT_EVALUATOR]: InitEvaluatorPayload
  [ActionType.INIT_EVALUATOR_SUCCESS]: null
  [ActionType.INIT_GENOME_FACTORY]: InitGenomeFactoryPayload<any, any>
  [ActionType.INIT_GENOME_FACTORY_SUCCESS]: null
  [ActionType.REQUEST_EVALUATE_MATCH]: EvaluateMatchPayload
  [ActionType.RESPOND_EVALUATE_MATCH]: PlayerScore[]
  [ActionType.REQUEST_CLEAR_GENOME_CACHE]: null
  [ActionType.RESPOND_CLEAR_GENOME_CACHE]: null
  [ActionType.TERMINATE]: null
}

export const createWorkerAction = <T extends ActionType>(
  type: T,
  payload: PayloadMap[T]
): ActionMessage<T, PayloadMap[T]> => createActionMessage(type, payload)
