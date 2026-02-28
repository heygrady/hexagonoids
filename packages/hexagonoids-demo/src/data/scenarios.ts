import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import type { ScenarioSnapshot } from '@heygrady/hexagonoids-environment'

const __dirname = dirname(fileURLToPath(import.meta.url))

/**
 * Load the scenario bank from the generated JSON file.
 *
 * The JSON file is created by running:
 *   node scripts/generate-scenarios.js --count 100
 *
 * Returns an empty array if the file contains no scenarios yet.
 */
export function loadScenarioBank(): ScenarioSnapshot[] {
  const filePath = resolve(__dirname, 'scenarios.json')
  const data = readFileSync(filePath, 'utf-8')
  return JSON.parse(data) as ScenarioSnapshot[]
}
