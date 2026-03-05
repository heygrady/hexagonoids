// Re-exports from utils/constants.ts so encoding modules can import from ./constants.ts
// without depending on ../utils directly. The public barrel (index.ts) exports these
// from utils/constants.ts — this file is the encoding-internal import alias.
export {
  MAX_CLOSING_SPEED,
  SOI_ANGULAR_RADIUS,
  SOI_ARC_DISTANCE,
} from '../utils/constants.js'
