import type { RawMetrics } from '@heygrady/hexagonoids-environment'
import type { LabSpecificOptions } from '../lab/types.js'
import type { TrainOptions } from '../training/train.js'

export type ScoringMethod = (
  metrics: RawMetrics,
  context: { generation: number }
) => number

export interface TrainingProfile {
  name: string
  config?: Partial<TrainOptions & LabSpecificOptions> | undefined
  scoringMethods?: Record<string, ScoringMethod> | undefined
}
