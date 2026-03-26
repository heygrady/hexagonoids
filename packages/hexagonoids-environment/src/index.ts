// Agents
export {
  type ActionController,
  createGameAgent,
  type GameAgent,
} from './agents/createGameAgent.js'
export { doNothingAgent } from './agents/doNothingAgent.js'
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
  CurriculumPattern,
  CurriculumScenarioParams,
  DistanceClass,
} from './curriculum/generateCurriculumScenario.js'
export {
  ALL_DISTANCE_CLASSES,
  ALL_PATTERNS,
} from './curriculum/generateCurriculumScenario.js'
export {
  type CurriculumResult,
  runCurriculum,
} from './curriculum/runCurriculum.js'
export {
  type ActionDecoder,
  binaryDecoder,
  pairedDecoder,
  selectDecoder,
} from './encoding/actionDecoders.js'
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
export { encodeGameState } from './encoding/encodeGameState.js'
// Encoding
export {
  BULLET_SLOTS,
  CONE_COUNT,
  FEATURES_PER_BULLET,
  FEATURES_PER_CONE,
  FEATURES_PER_ROCK,
  GLOBAL_FEATURES,
  INPUT_COUNT,
  ROCKS_PER_CONE,
} from './encoding/encodingPresets.js'
// Evaluation
export { aggregateMetrics } from './evaluation/aggregateMetrics.js'
// Behavioral profiling
export type {
  ActionProfile,
  BehavioralProfile,
  EngagementProfile,
  MovementProfile,
} from './evaluation/behavioralProfile.js'
export {
  computeBehavioralProfile,
  shannonEntropy,
} from './evaluation/behavioralProfile.js'
export {
  type ActionFrames,
  applyBehavioralGates,
  calculateBehavioralGate,
  calculateFitness,
  computeFitnessBreakdown,
  computeGateBreakdown,
  computeKillCycleTicks,
  computePossibleKills,
  engagementGate,
  evaluateFullGameFitness,
  type FitnessBreakdown,
  type FitnessContext,
  type GateBreakdown,
  type GauntletBreakdown,
  weightedFitnessSum,
  zScore,
} from './evaluation/calculateFitness.js'
export {
  BUCKET_SYSTEM,
  findBucketXYZ,
} from './evaluation/icosahedralBuckets.js'
export {
  METRIC_EPISODE_FITNESS,
  METRIC_GAUNTLET_BREAKDOWN,
} from './evaluation/metrics.js'
export type { MetricsCollector, RawMetrics } from './evaluation/RawMetrics.js'
export { createMetricsCollector } from './evaluation/RawMetrics.js'
export { computePossibleDeaths } from './evaluation/scenarioContext.js'
export {
  DEFAULT_REWARD_CONFIG,
  type RewardConfig,
  type SimulationHooks,
  simulateGame,
  type TickDeltas,
} from './evaluation/simulateGame.js'
// Environment
export { HexagonoidsEnvironment } from './HexagonoidsEnvironment.js'
export type {
  ActionGateConfig,
  BehavioralGateConfig,
  FitnessWeights,
  GateConfig,
  GateEasing,
  HexagonoidsEnvironmentConfig,
  SimulationConfig,
  TurnBiasGateConfig,
} from './HexagonoidsEnvironmentConfig.js'
export {
  DEFAULT_BEHAVIORAL_GATE_CONFIG,
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
