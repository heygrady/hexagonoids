import { appendFile, mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import type { SupportedAlgorithm } from '../registries/algorithmRegistry.js'
import { ensureSerializedOrganismMarker } from '../training/serialization/serializedOrganism.js'

const DEFAULT_OUTPUT_DIR = fileURLToPath(
  new URL('../../../../', import.meta.url)
)
const GENERATIONS_LOG_FILENAME = 'generations-log.jsonl'

const toSerializable = (value: unknown): unknown => {
  if (value == null || typeof value !== 'object') {
    return value
  }

  if ('toJSON' in value && typeof value.toJSON === 'function') {
    return value.toJSON()
  }

  return value
}

export interface GenerationLogEntry {
  generation: number
  method: SupportedAlgorithm
  bestFitness: number
  seeds: string[]
  seedsPerOrganism: number
  baseSeed: string
  elapsedMs: number
  timestamp: string
}

export const resolveGenerationsLogPath = (
  outputDir = DEFAULT_OUTPUT_DIR
): string => {
  return join(outputDir, GENERATIONS_LOG_FILENAME)
}

export async function appendGenerationLog(
  entry: GenerationLogEntry,
  outputDir = DEFAULT_OUTPUT_DIR
): Promise<string> {
  const logPath = resolveGenerationsLogPath(outputDir)
  await mkdir(dirname(logPath), { recursive: true })
  await appendFile(logPath, `${JSON.stringify(entry)}\n`, 'utf8')
  return logPath
}

export async function saveGenerationGenome(
  organism: unknown,
  generation: number,
  outputDir = DEFAULT_OUTPUT_DIR
): Promise<string> {
  const genomesDir = join(outputDir, 'genomes')
  await mkdir(genomesDir, { recursive: true })
  const padded = String(generation).padStart(3, '0')
  const filePath = join(genomesDir, `gen-${padded}.json`)
  const serialized = ensureSerializedOrganismMarker(toSerializable(organism))
  const json = JSON.stringify(serialized, null, 2)
  await writeFile(filePath, `${json}\n`, 'utf8')
  return filePath
}
