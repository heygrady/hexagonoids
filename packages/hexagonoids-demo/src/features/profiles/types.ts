import type { RawMetrics } from '@heygrady/hexagonoids-environment'

import type { TrainOptions } from '../../train.js'
import type { LabSpecificOptions } from '../lab/types.js'

export type ScoringMethod = (
  metrics: RawMetrics,
  context: { generation: number }
) => number

export interface TrainingProfile {
  name: string
  config?: Partial<TrainOptions & LabSpecificOptions> | undefined
  scoringMethods?: Record<string, ScoringMethod> | undefined
}
