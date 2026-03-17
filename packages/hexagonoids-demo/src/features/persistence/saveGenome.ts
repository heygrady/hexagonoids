import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'

import type { SupportedAlgorithm } from '../registries/algorithmRegistry.js'
import { ensureSerializedOrganismMarker } from '../training/serialization/serializedOrganism.js'
import { DEFAULT_ARTIFACTS_DIR } from './artifactPaths.js'

const DEFAULT_OUTPUT_DIR = DEFAULT_ARTIFACTS_DIR

const toSerializable = (value: unknown): unknown => {
  if (value == null || typeof value !== 'object') {
    return value
  }

  if ('toJSON' in value && typeof value.toJSON === 'function') {
    return value.toJSON()
  }

  return value
}

export const resolveBestGenomePath = (
  method: SupportedAlgorithm,
  outputDir = DEFAULT_OUTPUT_DIR
): string => {
  return join(outputDir, `best-${method}.json`)
}

export async function saveGenome(
  method: SupportedAlgorithm,
  organism: unknown,
  outputDir = DEFAULT_OUTPUT_DIR
): Promise<string> {
  const filePath = resolveBestGenomePath(method, outputDir)
  await mkdir(dirname(filePath), { recursive: true })
  const serialized = ensureSerializedOrganismMarker(toSerializable(organism))
  const json = JSON.stringify(serialized, null, 2)
  await writeFile(filePath, `${json}\n`, 'utf8')
  return filePath
}
