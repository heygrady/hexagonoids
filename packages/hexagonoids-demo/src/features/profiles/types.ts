import type {
  ActionGateConfig,
  BehavioralGateConfig,
  RuntimeScoringHooksConfig,
  TurnBiasGateConfig,
} from '@heygrady/hexagonoids-environment'
import type { LabSpecificOptions } from '../lab/types.js'
import type { TrainOptions } from '../training/train.js'

type ProfileBehavioralGateConfig = Partial<
  Omit<BehavioralGateConfig, 'thrust' | 'fire' | 'turn' | 'turnBias'>
> & {
  thrust?: Partial<ActionGateConfig> | undefined
  fire?: Partial<ActionGateConfig> | undefined
  turn?: Partial<ActionGateConfig> | undefined
  turnBias?: Partial<TurnBiasGateConfig> | undefined
}

export type TrainingProfileConfig = Omit<
  Partial<TrainOptions & LabSpecificOptions>,
  'fitnessWeights' | 'gateConfig' | 'behavioralGateConfig' | 'runtimeHooks'
> & {
  fitnessWeights?: Partial<NonNullable<TrainOptions['fitnessWeights']>> | undefined
  gateConfig?: Partial<NonNullable<TrainOptions['gateConfig']>> | undefined
  behavioralGateConfig?: ProfileBehavioralGateConfig | undefined
  runtimeHooks?: Partial<RuntimeScoringHooksConfig> | undefined
}

export type TrainingProfileHooks = RuntimeScoringHooksConfig

export interface TrainingProfileMetadata {
  label?: string | undefined
  description?: string | undefined
  tags?: string[] | undefined
}

export interface TrainingProfile {
  name: string
  base?: string | undefined
  config?: TrainingProfileConfig | undefined
  hooks?: TrainingProfileHooks | undefined
  meta?: TrainingProfileMetadata | undefined
}

export interface ResolvedTrainingProfile {
  name: string
  label: string
  selected: TrainingProfile
  chain: TrainingProfile[]
  config: TrainingProfileConfig
  hooks: TrainingProfileHooks
  meta: TrainingProfileMetadata
}
