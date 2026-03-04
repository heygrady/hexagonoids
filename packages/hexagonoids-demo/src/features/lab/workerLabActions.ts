import { createMessage } from '@neat-evolution/worker-actions'

import type { SupportedAlgorithm } from '../../algorithmRegistry.js'
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
  /** When true, worker includes per-seed raw metrics for main-thread scoring */
  includePerSeedMetrics: boolean
}

export interface AnalyzeBatchResultEntry {
  behavior: GenomeBehavior
  /** Only populated when includePerSeedMetrics was true in the request */
  perSeedMetrics?: import('@heygrady/hexagonoids-environment').RawMetrics[]
}

export interface AnalyzeBatchResult {
  entries: AnalyzeBatchResultEntry[]
}

// --- Message Creators ---

export const init = createMessage<InitPayload>(ActionType.INIT, () => ({}))

export const analyzeBatch = createMessage<AnalyzeBatchPayload>(
  ActionType.ANALYZE_BATCH
)

export const terminate = createMessage<null>(ActionType.TERMINATE, () => null)
