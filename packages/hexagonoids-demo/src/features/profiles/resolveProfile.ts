import { dirname, resolve as resolvePath } from 'node:path'

import defaultProfile from './default.js'
import { loadProfile } from './loadProfile.js'
import {
  finalizeResolvedTrainingProfile,
  resolveProfileChain,
} from './profileResolution.js'
import { getProfile } from './registry.js'
import type { ResolvedTrainingProfile, TrainingProfile } from './types.js'

interface ProfileWithSource extends TrainingProfile {
  __sourcePath?: string | undefined
}

async function loadProfileWithSource(
  profileRef: string,
  parentSourcePath?: string
): Promise<ProfileWithSource> {
  const resolvedPath =
    parentSourcePath != null && profileRef.startsWith('.')
      ? resolvePath(dirname(parentSourcePath), profileRef)
      : resolvePath(profileRef)
  const profile = (await loadProfile(resolvedPath)) as ProfileWithSource
  profile.__sourcePath = resolvedPath
  return profile
}

export async function resolveProfile(
  profileRef?: string
): Promise<ResolvedTrainingProfile> {
  if (profileRef == null) {
    return resolveProfileChain(defaultProfile, {
      defaultProfile,
      resolveBase: (ref) => getProfile(ref),
    })
  }

  const named = getProfile(profileRef)
  if (named != null) {
    return resolveProfileChain(named, {
      defaultProfile,
      resolveBase: (ref) => getProfile(ref),
    })
  }

  const selected = await loadProfileWithSource(profileRef)
  const loadedByRef = new Map<string, ProfileWithSource>()
  const loadedByPath = new Map<string, ProfileWithSource>([
    [selected.__sourcePath!, selected],
  ])
  const chain: TrainingProfile[] = []
  const added = new Set<string>()
  const visiting = new Set<string>()

  const appendUniqueProfile = (profile: TrainingProfile): void => {
    if (added.has(profile.name)) return
    added.add(profile.name)
    chain.push(profile)
  }

  const visit = async (profile: ProfileWithSource): Promise<void> => {
    const visitKey = profile.__sourcePath ?? `name:${profile.name}`
    if (visiting.has(visitKey)) {
      throw new Error(`Profile base cycle detected at "${profile.name}".`)
    }

    visiting.add(visitKey)

    if (profile.base != null) {
      const namedBase = getProfile(profile.base)
      if (namedBase != null) {
        await visit(namedBase as ProfileWithSource)
      } else {
        const resolvedBaseRef =
          profile.__sourcePath != null && profile.base.startsWith('.')
            ? resolvePath(dirname(profile.__sourcePath), profile.base)
            : resolvePath(profile.base)
        let loadedBase = loadedByPath.get(resolvedBaseRef)
        if (loadedBase == null) {
          loadedBase = loadedByRef.get(profile.base)
        }
        if (loadedBase == null) {
          loadedBase = await loadProfileWithSource(profile.base, profile.__sourcePath)
          if (loadedBase.__sourcePath != null) {
            loadedByPath.set(loadedBase.__sourcePath, loadedBase)
          }
          loadedByRef.set(profile.base, loadedBase)
        }
        await visit(loadedBase)
      }
    }

    appendUniqueProfile(profile)
    visiting.delete(visitKey)
  }

  appendUniqueProfile(defaultProfile)
  await visit(selected)

  return finalizeResolvedTrainingProfile(chain)
}
