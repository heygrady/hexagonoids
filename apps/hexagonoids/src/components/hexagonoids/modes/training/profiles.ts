import { getProfile, type TrainOptions } from '@heygrady/hexagonoids-demo'

/**
 * Look up a profile by name and map it to `Partial<TrainOptions>`
 * overrides. Returns `undefined` when the profile is not found.
 */
export function getObserveProfile(
  name: string
): Partial<TrainOptions> | undefined {
  const profile = getProfile(name)
  if (profile == null) return undefined
  return profile.config ?? {}
}
