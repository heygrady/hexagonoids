import type { TrainOptions } from '../../train.js'

export interface LabSpecificOptions {
  name?: string | undefined
  analysisSeedsPerGenome?: number | undefined
  analysisMaxTicks?: number | undefined
}

export type LabOptions = Partial<TrainOptions> & LabSpecificOptions

export interface LabConfig {
  experimentId: string
  analysisSeedsPerGenome: number
  analysisMaxTicks: number
  trainOptions: TrainOptions
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

export type {
  ScoringMethod,
  TrainingProfile,
  TrainingProfile as LabProfile,
} from '../profiles/types.js'

export interface LabAnalysis {
  config: LabConfig
  behaviors: GenomeBehavior[]
}
