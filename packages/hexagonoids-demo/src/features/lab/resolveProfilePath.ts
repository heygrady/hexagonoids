import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const PROFILES_DIR = fileURLToPath(
  new URL('../../../../.artifacts/profiles', import.meta.url)
)

/**
 * Resolve a profile nickname or path to an absolute file path.
 *
 * - If the value contains `/` or ends in `.json`/`.mjs` it is treated as a
 *   literal path and returned after `resolve()`.
 * - Otherwise it is treated as a nickname and resolved to
 *   `.artifacts/profiles/<name>.json` (falling back to `.mjs`).
 */
export function resolveProfilePath(nameOrPath: string): string {
  if (
    nameOrPath.includes('/') ||
    nameOrPath.endsWith('.json') ||
    nameOrPath.endsWith('.mjs')
  ) {
    return resolve(nameOrPath)
  }

  const jsonPath = resolve(PROFILES_DIR, `${nameOrPath}.json`)
  if (existsSync(jsonPath)) {
    return jsonPath
  }

  const mjsPath = resolve(PROFILES_DIR, `${nameOrPath}.mjs`)
  if (existsSync(mjsPath)) {
    return mjsPath
  }

  // Default to .json even if it doesn't exist — loadProfile will error
  return jsonPath
}
