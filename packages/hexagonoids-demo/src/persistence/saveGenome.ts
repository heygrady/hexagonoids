import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import type { SupportedAlgorithm } from '../algorithmRegistry.js'

const DEFAULT_OUTPUT_DIR = fileURLToPath(new URL('../../../', import.meta.url))

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
  const json = JSON.stringify(toSerializable(organism), null, 2)
  await writeFile(filePath, `${json}\n`, 'utf8')
  return filePath
}
