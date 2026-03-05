// Agents
export { doNothingAgent } from './agents/doNothingAgent.js'
export { createNeatAgent, neatAgent } from './agents/neatAgent.js'
export { randomAgent } from './agents/randomAgent.js'
export type { AgentContext, AgentFn } from './agents/types.js'
export {
  MEMORY_ROCK_PERCEPTION,
  MEMORY_SEEN_ROCKS,
} from './agents/types.js'
export {
  buildCurriculumParams,
  CURRICULUM_SCENARIO_COUNT,
  type CurriculumSnapshotResult,
  generateCurriculumSnapshot,
} from './curriculum/curriculumSnapshot.js'
// Curriculum
export type {
  ConeIndex,
  CurriculumScenarioParams,
  ScenarioVariant,
} from './curriculum/generateCurriculumScenario.js'
export { runCurriculum } from './curriculum/runCurriculum.js'
export {
  buildRockPerceptionPrecompute,
  collectObservations,
} from './encoding/collectObservations.js'
export {
  allNecklaceClasses,
  canonicalNecklace,
  coneOccupancyMask,
  hammingDistance,
  popcount8,
} from './encoding/coneOccupancy.js'
export { decodeOutputs } from './encoding/decodeOutputs.js'
export { encodeGameState } from './encoding/encodeGameState.js'
// Encoding
export {
  BULLET_SLOTS,
  CONE_COUNT,
  FEATURES_PER_BULLET,
  FEATURES_PER_CONE,
  GLOBAL_FEATURES,
  INPUT_COUNT,
} from './encoding/encodingPresets.js'
// Evaluation
export { aggregateMetrics } from './evaluation/aggregateMetrics.js'
export {
  type ActionFrames,
  actionDiversityGate,
  applyBehavioralGates,
  calculateFitness,
  computeKillCycleTicks,
  computePossibleKills,
  engagementGate,
  evaluateFullGameFitness,
  type FitnessContext,
  turnBiasGate,
  turnGate,
  weightedFitnessSum,
  zScore,
} from './evaluation/calculateFitness.js'
export {
  BUCKET_SYSTEM,
  findBucketXYZ,
} from './evaluation/icosahedralBuckets.js'
export type { MetricsCollector, RawMetrics } from './evaluation/RawMetrics.js'
export { createMetricsCollector } from './evaluation/RawMetrics.js'
export { computePossibleDeaths } from './evaluation/scenarioContext.js'
export { simulateGame } from './evaluation/simulateGame.js'
// Environment
export { HexagonoidsEnvironment } from './HexagonoidsEnvironment.js'
export type {
  FitnessWeights,
  GateConfig,
  GateEasing,
  HexagonoidsEnvironmentConfig,
  SimulationConfig,
} from './HexagonoidsEnvironmentConfig.js'
export {
  DEFAULT_HEXAGONOIDS_ENVIRONMENT_CONFIG,
  mergeConfig,
} from './HexagonoidsEnvironmentConfig.js'
// Scenarios
export { captureSnapshot } from './scenarios/captureSnapshot.js'
export type { CompactScenarioBankDocument } from './scenarios/codec.js'
export {
  decodeScenarioBankDocument,
  encodeScenarioBankDocument,
} from './scenarios/codec.js'
export { restoreSnapshot } from './scenarios/restoreSnapshot.js'
export { simulateScenario } from './scenarios/simulateScenario.js'
export type { StratifiedIndex } from './scenarios/stratifiedSample.js'
export {
  buildStratifiedIndex,
  stratifiedSample,
} from './scenarios/stratifiedSample.js'
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
  SOI_ANGULAR_RADIUS,
  SOI_ARC_DISTANCE,
} from './utils/constants.js'
export { yawToBearing } from './utils/sphericalBearing.js'
