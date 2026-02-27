// Agents
export { doNothingAgent } from './agents/doNothingAgent.js'
export { neatAgent } from './agents/neatAgent.js'
export { randomAgent } from './agents/randomAgent.js'
export type { AgentContext, AgentFn } from './agents/types.js'

// Environment
export { createEnvironment } from './createEnvironment.js'
export {
  collectObservations,
  LIDAR_RAY_COUNT,
} from './encoding/collectObservations.js'
// Encoding
export { decodeOutputs } from './encoding/decodeOutputs.js'
export { encodeGameState, INPUT_COUNT } from './encoding/encodeGameState.js'
export { bearingToSector } from './encoding/sectorUtils.js'
// Evaluation
export {
  calculateFitness,
  weightedFitnessSum,
  zScore,
} from './evaluation/calculateFitness.js'
export type { MetricsCollector, RawMetrics } from './evaluation/RawMetrics.js'
export { createMetricsCollector } from './evaluation/RawMetrics.js'
export { simulateGame } from './evaluation/simulateGame.js'
export { HexagonoidsEnvironment } from './HexagonoidsEnvironment.js'
export type {
  FitnessWeights,
  HexagonoidsEnvironmentConfig,
  SimulationConfig,
} from './HexagonoidsEnvironmentConfig.js'
export {
  DEFAULT_HEXAGONOIDS_ENVIRONMENT_CONFIG,
  mergeConfig,
} from './HexagonoidsEnvironmentConfig.js'

// Utils
export {
  MAX_CLOSING_SPEED,
  SECTOR_COUNT,
  SOI_ANGULAR_RADIUS,
  SOI_ARC_DISTANCE,
} from './utils/constants.js'
export { relativeBearing, sphericalBearing } from './utils/sphericalBearing.js'
