import defaultProfile from './default.js'
import { resolveProfileChain } from './profileResolution.js'
import { getProfile } from './registry.js'
import type { ResolvedTrainingProfile } from './types.js'

export function resolveRegisteredProfile(
  profileName?: string
): ResolvedTrainingProfile | undefined {
  if (profileName == null) {
    return resolveProfileChain(defaultProfile, {
      defaultProfile,
      resolveBase: (ref) => getProfile(ref),
    })
  }

  const selected = getProfile(profileName)
  if (selected == null) return undefined

  return resolveProfileChain(selected, {
    defaultProfile,
    resolveBase: (ref) => getProfile(ref),
  })
}
