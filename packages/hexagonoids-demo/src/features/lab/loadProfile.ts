import { readFile } from 'node:fs/promises'
import { extname, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

import { resolveProfilePath } from './resolveProfilePath.js'
import type { LabProfile, ScoringMethod } from './types.js'

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return value != null && typeof value === 'object'
}

export async function loadProfile(nameOrPath: string): Promise<LabProfile> {
  const absolutePath = resolve(resolveProfilePath(nameOrPath))
  const ext = extname(absolutePath).toLowerCase()

  if (ext === '.json') {
    const raw = await readFile(absolutePath, 'utf8')
    const parsed: unknown = JSON.parse(raw)
    if (!isRecord(parsed)) {
      return {}
    }
    return { config: parsed as LabProfile['config'] }
  }

  const fileUrl = pathToFileURL(absolutePath).href
  const mod: unknown = await import(fileUrl)

  if (!isRecord(mod)) {
    return {}
  }

  const profile: LabProfile = {}

  if (isRecord(mod.config)) {
    profile.config = mod.config as LabProfile['config']
  }

  if (isRecord(mod.scoringMethods)) {
    const methods: Record<string, ScoringMethod> = {}
    for (const [key, value] of Object.entries(mod.scoringMethods)) {
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
