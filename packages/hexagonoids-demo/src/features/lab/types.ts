import type {
  EncodingPreset,
  RawMetrics,
} from '@heygrady/hexagonoids-environment'

import type { SupportedAlgorithm } from '../../algorithmRegistry.js'

export interface LabConfig {
  experimentId: string
  method: SupportedAlgorithm
  encodingPreset: EncodingPreset
  iterations: number
  populationSize: number
  baseSeed: string
  scenarioMode: boolean
  scenariosPerOrganism: number
  scenarioMaxTicks: number
  evaluationSeedsPerOrganism: number
  maxTicks: number
  dtMs: number
  analysisSeedsPerGenome: number
  analysisMaxTicks: number
  weightRocks: number
  weightAccuracy: number
  weightSurvival: number
  gateFloor: number
  actionLow: number
  actionHigh: number
  actionSteepness: number
  turnGateFloor: number
  turnLow: number
  turnHigh: number
  turnSteepness: number
  scenarioWeight: number
  scenarioSeedsPerOrganism: number
  fullGameSeedsPerOrganism: number
  profilePath?: string | undefined
}

export interface ActionProfile {
  thrustPct: number
  firePct: number
  leftPct: number
  rightPct: number
  entropy: number
}

export interface MovementProfile {
  distanceTraveled: number
  uniqueCells: number
  idlePct: number
}

export interface EngagementProfile {
  framesWithRocksInSOIPct: number
}

export interface ScoringProfile {
  productionFitness: number
  alternativeScores: Record<string, number>
}

export interface GenomeBehavior {
  generation: number
  trainingFitness: number
  action: ActionProfile
  movement: MovementProfile
  engagement: EngagementProfile
  scoring: ScoringProfile
  rocksDestroyed: number
  accuracy: number
  deaths: number
  score: number
}

export type ScoringMethod = (
  metrics: RawMetrics,
  context: { generation: number }
) => number

export interface LabProfile {
  config?: Partial<LabConfig> | undefined
  scoringMethods?: Record<string, ScoringMethod> | undefined
}

export interface LabAnalysis {
  config: LabConfig
  behaviors: GenomeBehavior[]
}

export interface LabOptions {
  name?: string | undefined
  profilePath?: string | undefined
  method?: SupportedAlgorithm | undefined
  encodingPreset?: EncodingPreset | undefined
  iterations?: number | undefined
  populationSize?: number | undefined
  baseSeed?: string | undefined
  maxTicks?: number | undefined
  dtMs?: number | undefined
  evaluationSeedsPerOrganism?: number | undefined
  scenarioMode?: boolean | undefined
  scenariosPerOrganism?: number | undefined
  scenarioMaxTicks?: number | undefined
  analysisSeedsPerGenome?: number | undefined
  analysisMaxTicks?: number | undefined
  secondsLimit?: number | undefined
  earlyStopPatience?: number | undefined
  logInterval?: number | undefined
  threadCount?: number | undefined
  weightRocks?: number | undefined
  weightAccuracy?: number | undefined
  weightSurvival?: number | undefined
  gateFloor?: number | undefined
  actionLow?: number | undefined
  actionHigh?: number | undefined
  actionSteepness?: number | undefined
  turnGateFloor?: number | undefined
  turnLow?: number | undefined
  turnHigh?: number | undefined
  turnSteepness?: number | undefined
  scenarioWeight?: number | undefined
  scenarioSeedsPerOrganism?: number | undefined
  fullGameSeedsPerOrganism?: number | undefined
}
