import defaultProfile from './default.js'
import type { TrainingProfile } from './types.js'

export { default as defaultProfile } from './default.js'
export type { ScoringMethod, TrainingProfile } from './types.js'

const profileMap = new Map<string, TrainingProfile>([
  [defaultProfile.name, defaultProfile],
])

/** Look up a registered profile by name. */
export function getProfile(name: string): TrainingProfile | undefined {
  return profileMap.get(name)
}

/** Register a profile so it can be looked up by name. */
export function registerProfile(profile: TrainingProfile): void {
  profileMap.set(profile.name, profile)
}
