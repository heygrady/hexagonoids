import defaultProfile from './default.js'
import turnDisciplineRigProfile from './turnDisciplineRig.js'
import turnHigh098Profile from './turnHigh098.js'
import type { TrainingProfile } from './types.js'

const profileMap = new Map<string, TrainingProfile>([
  [defaultProfile.name, defaultProfile],
  [turnHigh098Profile.name, turnHigh098Profile],
  [turnDisciplineRigProfile.name, turnDisciplineRigProfile],
])

/** Look up a registered profile by name. */
export function getProfile(name: string): TrainingProfile | undefined {
  return profileMap.get(name)
}

/** Register a profile so it can be looked up by name. */
export function registerProfile(profile: TrainingProfile): void {
  profileMap.set(profile.name, profile)
}

/** List registered profiles in insertion order. */
export function listProfiles(): TrainingProfile[] {
  return [...profileMap.values()]
}
