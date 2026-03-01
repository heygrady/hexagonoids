import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import type { ScenarioSnapshot } from '@heygrady/hexagonoids-environment'

/** Walk up from current file to find the package root (directory with package.json). */
function findPackageRoot(): string {
  let dir = dirname(fileURLToPath(import.meta.url))
  while (dir !== dirname(dir)) {
    if (existsSync(resolve(dir, 'package.json'))) return dir
    dir = dirname(dir)
  }
  throw new Error('Could not find package root')
}

const PACKAGE_ROOT = findPackageRoot()

/**
 * Load the scenario bank from the generated JSON file.
 *
 * The JSON file is created by running:
 *   yarn workspace @heygrady/hexagonoids-demo demo scenarios
 *
 * Returns an empty array if the file contains no scenarios yet.
 */
export function loadScenarioBank(): ScenarioSnapshot[] {
  const filePath = resolve(PACKAGE_ROOT, 'src/data/scenarios.json')
  const data = readFileSync(filePath, 'utf-8')
  return JSON.parse(data) as ScenarioSnapshot[]
}
