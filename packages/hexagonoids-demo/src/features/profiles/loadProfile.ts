import { readFile } from 'node:fs/promises'
import { basename, extname, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

import type { ScoringMethod, TrainingProfile } from './types.js'

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return value != null && typeof value === 'object'
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
    return { name, config: parsed as TrainingProfile['config'] }
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

  if (isRecord(target.config)) {
    profile.config = target.config as TrainingProfile['config']
  }

  if (isRecord(target.scoringMethods)) {
    const methods: Record<string, ScoringMethod> = {}
    for (const [key, value] of Object.entries(target.scoringMethods)) {
      if (typeof value === 'function') {
        methods[key] = value as ScoringMethod
      }
    }
    if (Object.keys(methods).length > 0) {
      profile.scoringMethods = methods
    }
  }

  return profile
}
