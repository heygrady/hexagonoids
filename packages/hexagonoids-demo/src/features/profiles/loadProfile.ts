import { readFile } from 'node:fs/promises'
import { basename, extname, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

import type { TrainingProfile } from './types.js'

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return value != null && typeof value === 'object'
}

const isStringArray = (value: unknown): value is string[] => {
  return Array.isArray(value) && value.every((item) => typeof item === 'string')
}

const isProfileShape = (value: Record<string, unknown>): boolean => {
  return (
    'name' in value ||
    'base' in value ||
    'config' in value ||
    'hooks' in value ||
    'meta' in value
  )
}

function assignProfileFields(
  profile: TrainingProfile,
  target: Record<string, unknown>
): void {
  if (typeof target.name === 'string') {
    profile.name = target.name
  }

  if (typeof target.base === 'string' && target.base.length > 0) {
    profile.base = target.base
  }

  if (isRecord(target.config)) {
    profile.config = target.config as TrainingProfile['config']
  } else if (!isProfileShape(target)) {
    profile.config = target as TrainingProfile['config']
  }

  if (isRecord(target.hooks)) {
    const hooks: NonNullable<TrainingProfile['hooks']> = {}
    if (typeof target.hooks.reward === 'string') {
      hooks.reward = target.hooks.reward
    }
    if (typeof target.hooks.fitness === 'string') {
      hooks.fitness = target.hooks.fitness
    }
    if (Object.keys(hooks).length > 0) {
      profile.hooks = hooks
    }
  }

  if (isRecord(target.meta)) {
    const meta: NonNullable<TrainingProfile['meta']> = {}
    if (typeof target.meta.label === 'string') {
      meta.label = target.meta.label
    }
    if (typeof target.meta.description === 'string') {
      meta.description = target.meta.description
    }
    if (isStringArray(target.meta.tags) && target.meta.tags.length > 0) {
      meta.tags = target.meta.tags
    }
    if (Object.keys(meta).length > 0) {
      profile.meta = meta
    }
  }
}

/**
 * Load a profile from a file path. Supports `.json`, `.mjs`, and `.ts` files.
 * The profile name is derived from the filename.
 */
export async function loadProfile(filePath: string): Promise<TrainingProfile> {
  const absolutePath = resolve(filePath)
  const ext = extname(absolutePath).toLowerCase()
  const name = basename(absolutePath, ext)

  if (ext === '.json') {
    const raw = await readFile(absolutePath, 'utf8')
    const parsed: unknown = JSON.parse(raw)
    if (!isRecord(parsed)) {
      return { name }
    }
    const profile: TrainingProfile = { name }
    assignProfileFields(profile, parsed)
    return profile
  }

  const fileUrl = pathToFileURL(absolutePath).href
  const mod: unknown = await import(fileUrl)

  if (!isRecord(mod)) {
    return { name }
  }

  // Support default export (TS modules export `default: TrainingProfile`)
  const target = isRecord(mod.default) ? mod.default : mod

  const profile: TrainingProfile = {
    name: typeof target.name === 'string' ? target.name : name,
  }
  assignProfileFields(profile, target)

  return profile
}
