// Agents
export { doNothingAgent } from './agents/doNothingAgent.js'
export { neatAgent } from './agents/neatAgent.js'
export { randomAgent } from './agents/randomAgent.js'
export { seekDestroyAgent } from './agents/seekDestroyAgent.js'

// Types
export type { AgentContext, AgentFn, SyncExecutor } from './agents/types.js'

// Encoding
export { decodeOutputs } from './encoding/decodeOutputs.js'
export { encodeGameState, INPUT_COUNT } from './encoding/encodeGameState.js'
export { bearingToSector } from './encoding/sectorUtils.js'

// Evaluation
export type { MetricsCollector, RawMetrics } from './evaluation/RawMetrics.js'
export { createMetricsCollector } from './evaluation/RawMetrics.js'
export type { SimulationConfig } from './evaluation/simulateGame.js'
export { simulateGame } from './evaluation/simulateGame.js'

// Utils
export {
  MAX_CLOSING_SPEED,
  SECTOR_COUNT,
  SOI_ANGULAR_RADIUS,
  SOI_ARC_DISTANCE,
} from './utils/constants.js'
export { relativeBearing, sphericalBearing } from './utils/sphericalBearing.js'
