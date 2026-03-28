import type { TrainingProfile } from './types.js'

/**
 * Small authoring helper that preserves profile types without changing
 * runtime behavior. Part 01 uses this to make the intended contract explicit
 * before shared resolution and runtime hook execution land.
 */
export function defineProfile<const T extends TrainingProfile>(
  profile: T
): T {
  return profile
}
