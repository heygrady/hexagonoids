import { createMessage } from '@neat-evolution/worker-actions'

import type {
  CandidateAnnotations,
  ScenarioSnapshot,
  SourceGenome,
} from './types.js'

export enum ActionType {
  INIT = 'INIT',
  COLLECT_CANDIDATES = 'COLLECT_CANDIDATES',
  FILTER_INSTANT_DEATH = 'FILTER_INSTANT_DEATH',
  SCOUT_AGENT = 'SCOUT_AGENT',
  ANNOTATE_BATCH = 'ANNOTATE_BATCH',
  TERMINATE = 'TERMINATE',
}

// --- Payloads ---

export type InitPayload = {}

export interface CollectCandidatesPayload {
  source: SourceGenome
  countPerSource: number
  seed: string
  rewind: number
  maxGames: number
  captureTypes: Array<'death' | 'kill'>
  killRatio: number
}

/** Worker returns only snapshots; main thread wraps with makeScenarioCandidate */
export interface CollectCandidatesResult {
  scenarios: ScenarioSnapshot[]
}

/** Minimal scenario reference for worker simulation — no redundant source data */
export interface ScenarioRef {
  id: string
  scenario: ScenarioSnapshot
}

export interface FilterInstantDeathPayload {
  scenarioRefs: ScenarioRef[]
  seed: string
  instantDeathTicks: number
  instantDeathTrials: number
}

export interface FilterInstantDeathKept {
  id: string
  instantDeathTicks: number
  instantDeathTrials: number
}

export interface FilterInstantDeathRemoved {
  id: string
  instantDeathTicks: number
  instantDeathTrials: number
}

export interface FilterInstantDeathResult {
  kept: FilterInstantDeathKept[]
  removed: FilterInstantDeathRemoved[]
}

export interface ScoutAgentPayload {
  source: SourceGenome
  /** Only the scenario snapshots needed for scouting — no candidate metadata */
  scoutScenarios: ScenarioSnapshot[]
  evalTicks: number
}

export interface ScoutAgentResult {
  id: string
  signature: number[]
}

export interface AnnotateBatchPayload {
  scenarioRefs: ScenarioRef[]
  panelSources: SourceGenome[]
  evalTicks: number
  randomBaselineTrials: number
  seed: string
}

/** Per-candidate annotation result keyed by candidate id */
export interface AnnotationResult {
  id: string
  annotations: CandidateAnnotations
}

export interface AnnotateBatchResult {
  annotations: AnnotationResult[]
}

// --- Message Creators ---

export const init = createMessage<InitPayload>(ActionType.INIT, () => ({}))

export const collectCandidates = createMessage<
  CollectCandidatesPayload,
  CollectCandidatesResult
>(ActionType.COLLECT_CANDIDATES)

export const filterInstantDeath = createMessage<
  FilterInstantDeathPayload,
  FilterInstantDeathResult
>(ActionType.FILTER_INSTANT_DEATH)

export const scoutAgent = createMessage<ScoutAgentPayload, ScoutAgentResult>(
  ActionType.SCOUT_AGENT
)

export const annotateBatch = createMessage<
  AnnotateBatchPayload,
  AnnotateBatchResult
>(ActionType.ANNOTATE_BATCH)

export const terminate = createMessage<null>(ActionType.TERMINATE, () => null)
