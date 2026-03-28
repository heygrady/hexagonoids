import { createMessage } from '@neat-evolution/worker-actions'

import type { SupportedAlgorithm } from '../registries/algorithmRegistry.js'
import type { GenomeBehavior } from './types.js'

export enum ActionType {
  INIT = 'INIT',
  ANALYZE_BATCH = 'ANALYZE_BATCH',
  TERMINATE = 'TERMINATE',
}

// --- Payloads ---

export type InitPayload = {}

export interface GenomeRef {
  genomePath: string
  generation: number
}

export interface AnalyzeBatchPayload {
  genomeRefs: GenomeRef[]
  method: SupportedAlgorithm
  seedsPerGenome: number
  maxTicks: number
  dtMs: number
  baseSeed: string
  /** Optional fitness weights from the training profile for production fitness scoring */
  fitnessWeights?: import('@heygrady/hexagonoids-environment').FitnessWeights
  /** Optional gate config from the training profile for production fitness scoring */
  gateConfig?: import('@heygrady/hexagonoids-environment').GateConfig
}

export interface AnalyzeBatchResultEntry {
  behavior: GenomeBehavior
}

export interface AnalyzeBatchResult {
  entries: AnalyzeBatchResultEntry[]
}

// --- Message Creators ---

export const init = createMessage<InitPayload>(ActionType.INIT, () => ({}))

export const analyzeBatch = createMessage<
  AnalyzeBatchPayload,
  AnalyzeBatchResult
>(ActionType.ANALYZE_BATCH)

export const terminate = createMessage<null>(ActionType.TERMINATE, () => null)
