import {
  resolveRegisteredProfile,
  type ResolvedTrainingProfile,
} from '@heygrady/hexagonoids-demo'

export function getObserveProfile(
  name?: string
): ResolvedTrainingProfile | undefined {
  return resolveRegisteredProfile(name)
}
