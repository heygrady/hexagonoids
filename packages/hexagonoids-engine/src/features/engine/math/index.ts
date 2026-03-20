export { quat, quatIdentity, vec3, vec3Zero } from './create.js'
export type { PooledQuat, PooledVec3 } from './pools.js'
export { QuatPool, Vec3Pool } from './pools.js'
export {
  quatCopy,
  quatFromAxisAngle,
  quatFromUnitPoint,
  quatFromYawPitchRoll,
  quatMultiply,
  quatNormalize,
  quatSet,
  quatToUnitPoint,
} from './quat.js'
export type { Quat, Vec3 } from './types.js'
export {
  vec3AddInPlace,
  vec3ApplyQuat,
  vec3Copy,
  vec3Cross,
  vec3Dot,
  vec3Equals,
  vec3Length,
  vec3LengthSq,
  vec3Normalize,
  vec3Scale,
  vec3ScaleInPlace,
  vec3Set,
} from './vec3.js'
