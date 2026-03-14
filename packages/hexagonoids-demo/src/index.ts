export * from './algorithmRegistry.js'
export { buildEnvironmentOptions } from './buildEnvironmentOptions.js'
export * from './configDefaults.js'
export * from './EvolutionManager.js'
export * from './evaluation/evaluateOrganism.js'
export * from './evaluation/seedSchedule.js'
export type { LabConfig, LabSpecificOptions } from './features/lab/types.js'

export {
  defaultProfile,
  getProfile,
  registerProfile,
} from './features/profiles/index.js'
export type {
  ScoringMethod,
  TrainingProfile,
} from './features/profiles/types.js'
export type { TrainOptions } from './train.js'
