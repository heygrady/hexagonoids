// Agents
export { doNothingAgent } from './agents/doNothingAgent.js'
export { neatAgent } from './agents/neatAgent.js'
export { randomAgent } from './agents/randomAgent.js'
export type { AgentContext, AgentFn } from './agents/types.js'
export {
  collectObservations,
  LIDAR_RAY_COUNT,
} from './encoding/collectObservations.js'
// Encoding
export { decodeOutputs } from './encoding/decodeOutputs.js'
export { encodeGameState, INPUT_COUNT } from './encoding/encodeGameState.js'
export { bearingToSector } from './encoding/sectorUtils.js'
// Evaluation
export { aggregateMetrics } from './evaluation/aggregateMetrics.js'
export {
  actionDiversityGate,
  calculateFitness,
  engagementGate,
  evaluateFullGameFitness,
  type FitnessContext,
  turnGate,
  weightedFitnessSum,
  zScore,
} from './evaluation/calculateFitness.js'
export {
  BUCKET_SYSTEM,
  findBucketXYZ,
} from './evaluation/icosahedralBuckets.js'
export type {
  SimulationProfiler,
  SimulationStage,
} from './evaluation/perfProfiler.js'
export type { MetricsCollector, RawMetrics } from './evaluation/RawMetrics.js'
export { createMetricsCollector } from './evaluation/RawMetrics.js'
export {
  fullGameMaximums,
  scenarioMaximums,
  scenarioPossibleDeaths,
} from './evaluation/scenarioContext.js'
export { simulateGame } from './evaluation/simulateGame.js'
// Environment
export { HexagonoidsEnvironment } from './HexagonoidsEnvironment.js'
export type {
  FitnessWeights,
  GateConfig,
  HexagonoidsEnvironmentConfig,
  ProfilingConfig,
  SimulationConfig,
} from './HexagonoidsEnvironmentConfig.js'
export {
  DEFAULT_HEXAGONOIDS_ENVIRONMENT_CONFIG,
  mergeConfig,
} from './HexagonoidsEnvironmentConfig.js'
// Scenarios
export { captureSnapshot } from './scenarios/captureSnapshot.js'
export { restoreSnapshot } from './scenarios/restoreSnapshot.js'
export { simulateScenario } from './scenarios/simulateScenario.js'
export type {
  ScenarioBulletState,
  ScenarioPlayerState,
  ScenarioRockState,
  ScenarioShipState,
  ScenarioSnapshot,
} from './scenarios/types.js'
// Utils
export {
  MAX_CLOSING_SPEED,
  SECTOR_COUNT,
  SOI_ANGULAR_RADIUS,
  SOI_ARC_DISTANCE,
} from './utils/constants.js'
export { relativeBearing, sphericalBearing } from './utils/sphericalBearing.js'
