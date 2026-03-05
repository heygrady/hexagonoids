import {
  decodeScenarioBankDocument,
  type ScenarioSnapshot,
} from '@heygrady/hexagonoids-environment'

import { inflateBase64Gzip } from './inflateBase64Gzip.js'

/**
 * Load the scenario bank from the generated compressed data file.
 *
 * The data file is created by running:
 *   yarn workspace @heygrady/hexagonoids-demo demo scenarios
 *
 * Returns an empty array if the file contains no scenarios yet.
 */
export async function loadScenarioBank(): Promise<ScenarioSnapshot[]> {
  const { default: compressed } = await import('./scenarioBank.js')
  const json = await inflateBase64Gzip(compressed)
  return decodeScenarioBankDocument(JSON.parse(json))
}
