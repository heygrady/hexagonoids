export const CONE_COUNT = 8

/** Multiplier on stand-still bullet range for the proximity zero-crossing. */
export const BULLET_RANGE_MULTIPLIER = 1.0
export const FEATURES_PER_CONE = 4
export const BULLET_SLOTS = 6
export const FEATURES_PER_BULLET = 4
export const GLOBAL_FEATURES = 2
export const INPUT_COUNT =
  GLOBAL_FEATURES +
  CONE_COUNT * FEATURES_PER_CONE +
  BULLET_SLOTS * FEATURES_PER_BULLET // 58
