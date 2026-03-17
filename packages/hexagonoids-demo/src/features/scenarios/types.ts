import type {
  ActionController,
  AgentFn,
  ScenarioSnapshot as EnvironmentScenarioSnapshot,
  FitnessContext,
  FitnessWeights,
  GameAgent,
  GateConfig,
  HexagonoidsEnvironmentConfig,
  RawMetrics,
} from '@heygrady/hexagonoids-environment'
import type { StaticExecutor } from '@neat-evolution/executor'

import type { SupportedAlgorithm } from '../registries/algorithmRegistry.js'

export type SourceKind = 'best-of-lab' | 'hero-gen' | 'existing-bank'

export interface ExpectedIoShape {
  inputs: number
  outputs: number
}

export interface ScenarioOptions {
  labRoot: string
  maxLabs: number
  heroCount: number
  countPerSource: number
  panelMax: number
  panelScoutCount: number
  rewind: number
  maxGames: number
  evalTicks: number
  instantDeathTrials: number
  randomBaselineTrials: number
  finalCount: number
  killRatio: number
  seed: string
  output: string
  existing: string
  mergeExisting: boolean
  report: string | undefined
  dryRun: boolean
}

export interface GenomeIoShape {
  inputs: number
  outputs: number
}

export interface SourceGenome {
  id: string
  labId: string
  kind: SourceKind
  genomePath: string
  method: SupportedAlgorithm | null
  generation: number | null
  measuredFitness: number | null
  io: GenomeIoShape | null
}

export interface RejectedSource {
  pathname: string
  reason: string
}

export interface SourceReport {
  sources: SourceGenome[]
  rejected: RejectedSource[]
  kinds: SourceKind[]
}

export type ScenarioSnapshot = EnvironmentScenarioSnapshot

export interface CandidateSummary {
  wave: number
  difficulty: number
  rocks: number
}

export interface CandidateFilterInfo {
  instantDeathTicks: number
  instantDeathTrials: number
  instantDeathAllDied: boolean
}

export interface CandidateEvaluation {
  agentId: string
  died: boolean
  deaths: number
  rocksDestroyed: number
  shotsFired: number
  shotsHit: number
  fitness: number
}

export interface RandomBaselineResult {
  trials: number
  survivals: number
  allDied: boolean
}

export interface CandidateAnnotations {
  evaluations: CandidateEvaluation[]
  panelSize: number
  failures: number
  failureRate: number
  averageFitness: number
  randomBaseline: RandomBaselineResult
  likelyUnrecoverable: boolean
}

export interface CandidateCluster {
  size: number
  behaviorSize: number
  behaviorSignature: string
}

export interface ConeMetadata {
  mask: number // Raw 8-bit cone occupancy (0-255)
  necklace: number // Canonical necklace representative
  popcount: number // Number of filled cones (0-8)
}

export interface ScenarioCandidate {
  id: string
  source: SourceGenome
  scenario: ScenarioSnapshot
  summary: CandidateSummary
  filters?: CandidateFilterInfo
  annotations?: CandidateAnnotations
  cluster?: CandidateCluster
  interestingness?: number
  cone?: ConeMetadata
}

export interface AgentHandle {
  id: string
  label: string
  source: SourceGenome
  agent: AgentFn
  executor: StaticExecutor
}

export interface PanelAgentScore {
  sourceId: string
  competence: number
  diversity?: number
  lineageBonus?: number
  selectionScore?: number
  selected: boolean
}

export interface PanelReport {
  panelHandles: AgentHandle[]
  scoutCandidates: ScenarioCandidate[]
  selectionMode: 'all-sources' | 'top-fitness-fallback' | 'diverse-greedy'
  agentScores: PanelAgentScore[]
}

export interface InstantDeathRemovedCandidate {
  id: string
  sourceId: string
  instantDeathTicks: number
  instantDeathTrials: number
}

export interface InstantDeathFilterReport {
  kept: ScenarioCandidate[]
  removed: InstantDeathRemovedCandidate[]
  instantDeathTicks: number
}

export interface BehaviorPassCluster {
  representativeId: string
  representativeSourceId: string
  behaviorSize: number
  behaviorSignature: string
}

export interface DedupeReport {
  finalCandidates: ScenarioCandidate[]
  behaviorPass: {
    inputCount: number
    outputCount: number
    clusters: BehaviorPassCluster[]
  }
}

export interface ScenarioRunCounts {
  discoveredSources: number
  reviewPanelSources: number
  rejectedSources: number
  generatedCandidates: number
  mergedExistingCandidates: number
  rawCandidates: number
  postInstantDeathCandidates: number
  annotatedCandidates: number
  dedupedCandidates: number
  finalScenarios: number
}

interface EvolutionManager {
  hydrateToExecutor(
    genomePath: string,
    method: SupportedAlgorithm
  ): StaticExecutor
}

export interface ScenarioRuntime extends EvolutionManager {
  generateScenarios(config: {
    count: number
    baseSeed: string
    rewindFrames: number
    maxGames: number
    agent: AgentFn
    captureTypes?: Array<'death' | 'kill'>
    killRatio?: number
  }): ScenarioSnapshot[]
  createVanillaController(
    executor: StaticExecutor,
    options: Record<string, unknown>
  ): ActionController
  createGameAgent(agent: ActionController): GameAgent
  randomAgent: AgentFn
  simulateScenario(
    agent: AgentFn,
    scenario: ScenarioSnapshot,
    simConfig: { maxTicks: number; dtMs: number },
    seed: string
  ): RawMetrics
  weightedFitnessSum(
    metrics: RawMetrics,
    fitnessWeights: FitnessWeights,
    gateConfig: GateConfig,
    context: FitnessContext
  ): number
  computePossibleDeaths(elapsedTicks: number, dtMs: number): number
  DEFAULT_HEXAGONOIDS_ENVIRONMENT_CONFIG: Pick<
    HexagonoidsEnvironmentConfig,
    'simulation' | 'fitnessWeights' | 'gateConfig'
  >
}
