import { appendFile, mkdir } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import type { SupportedAlgorithm } from '../algorithmRegistry.js'

const DEFAULT_OUTPUT_DIR = fileURLToPath(new URL('../../../', import.meta.url))
const HEROES_LOG_FILENAME = 'heroes-log.jsonl'

export interface HeroLogEntry {
  generation: number
  method: SupportedAlgorithm
  bestFitness: number
  seeds: string[]
  seedsPerOrganism: number
  baseSeed: string
  elapsedMs: number
  timestamp: string
}

export const resolveHeroesLogPath = (
  outputDir = DEFAULT_OUTPUT_DIR
): string => {
  return join(outputDir, HEROES_LOG_FILENAME)
}

export async function appendHeroesLog(
  entry: HeroLogEntry,
  outputDir = DEFAULT_OUTPUT_DIR
): Promise<string> {
  const logPath = resolveHeroesLogPath(outputDir)
  await mkdir(dirname(logPath), { recursive: true })
  await appendFile(logPath, `${JSON.stringify(entry)}\n`, 'utf8')
  return logPath
}
