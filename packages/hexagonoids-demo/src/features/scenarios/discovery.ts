import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { basename, extname, join } from 'node:path'

import {
  DEFAULT_ENCODING_PRESET,
  type EncodingPreset,
  getInputCountForEncoding,
  isEncodingPreset,
} from '@heygrady/hexagonoids-environment'
import { z } from 'zod'

import type { SupportedAlgorithm } from '../../algorithmRegistry.js'
import { EXPECTED_OUTPUTS, SUPPORTED_IO } from './options.js'
import type {
  GenomeIoShape,
  RejectedSource,
  ScenarioOptions,
  SourceGenome,
  SourceKind,
  SourceReport,
} from './types.js'

function isRecord(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === 'object'
}

function readJson(pathname: string): unknown {
  return JSON.parse(readFileSync(pathname, 'utf8'))
}

function readJsonLines(pathname: string): unknown[] {
  if (!existsSync(pathname)) return []
  const lines = readFileSync(pathname, 'utf8')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)

  return lines.map((line) => JSON.parse(line))
}

const labConfigSchema = z
  .object({
    method: z
      .enum(['CPPN', 'NEAT', 'HyperNEAT', 'ES-HyperNEAT', 'DES-HyperNEAT'])
      .optional(),
    encodingPreset: z.enum(['four', 'five', 'six']).optional(),
  })
  .passthrough()

function genomeIoShape(serialized: unknown): GenomeIoShape | null {
  if (!isRecord(serialized)) return null
  const genome = serialized.genome
  if (!isRecord(genome)) return null
  const genomeOptions = genome.genomeOptions
  if (!isRecord(genomeOptions)) return null
  const initConfig = genomeOptions.initConfig
  if (!isRecord(initConfig)) return null

  const inputs = Number(initConfig.inputs)
  const outputs = Number(initConfig.outputs)
  if (!Number.isFinite(inputs) || !Number.isFinite(outputs)) return null

  return { inputs, outputs }
}

function inferEncodingPreset(inputs: number): EncodingPreset | null {
  if (inputs === getInputCountForEncoding('four')) return 'four'
  if (inputs === getInputCountForEncoding('five')) return 'five'
  if (inputs === getInputCountForEncoding('six')) return 'six'
  return null
}

function readLabConfig(pathname: string): {
  method: SupportedAlgorithm
  encodingPreset: EncodingPreset
} {
  const fallback = {
    method: 'HyperNEAT' as SupportedAlgorithm,
    encodingPreset: DEFAULT_ENCODING_PRESET,
  }
  const configPath = join(pathname, 'config.json')
  if (!existsSync(configPath)) return fallback

  let parsed: unknown
  try {
    parsed = readJson(configPath)
  } catch {
    return fallback
  }
  const result = labConfigSchema.safeParse(parsed)
  if (!result.success) return fallback

  return {
    method: result.data.method ?? fallback.method,
    encodingPreset:
      (result.data.encodingPreset != null &&
      isEncodingPreset(result.data.encodingPreset)
        ? result.data.encodingPreset
        : null) ?? fallback.encodingPreset,
  }
}

function isCompatibleGenome(serialized: unknown): boolean {
  const shape = genomeIoShape(serialized)
  return (
    shape != null &&
    shape.outputs === EXPECTED_OUTPUTS &&
    SUPPORTED_IO.some((candidate) => candidate.inputs === shape.inputs)
  )
}

function parseGenerationNumber(pathname: string): number | null {
  const match = basename(pathname).match(/^gen-(\d+)\.json$/)
  return match != null ? Number(match[1]) : null
}

function listRecentLabs(labRoot: string, maxLabs: number): string[] {
  if (!existsSync(labRoot)) {
    throw new Error(`Lab root not found: ${labRoot}`)
  }

  return readdirSync(labRoot)
    .filter((entry) => !entry.startsWith('.'))
    .map((entry) => join(labRoot, entry))
    .filter((pathname) => {
      try {
        return extname(pathname) === ''
      } catch {
        return false
      }
    })
    .sort()
    .slice(-maxLabs)
    .reverse()
}

function loadGenerationFitnessMap(labPath: string): Map<number, number> {
  const rows = readJsonLines(join(labPath, 'generations-log.jsonl'))
  const byGeneration = new Map<number, number>()
  for (const row of rows) {
    if (
      isRecord(row) &&
      Number.isFinite(row.generation) &&
      Number.isFinite(row.bestFitness)
    ) {
      byGeneration.set(Number(row.generation), Number(row.bestFitness) || 0)
    }
  }
  return byGeneration
}

function pickSampleIndices(total: number, desiredCount: number): number[] {
  if (total <= 0 || desiredCount <= 0) return []
  if (desiredCount >= total) {
    return Array.from({ length: total }, (_, i) => i)
  }

  const indices = new Set([0, total - 1])
  if (desiredCount === 1) return [0]

  const steps = desiredCount - 1
  for (let i = 0; i <= steps; i++) {
    const index = Math.round((i * (total - 1)) / steps)
    indices.add(index)
  }

  return [...indices].sort((a, b) => a - b)
}

function sampleHeroGenomePaths(labPath: string, heroCount: number): string[] {
  const genomesDir = join(labPath, 'genomes')
  if (!existsSync(genomesDir)) return []

  const genomeFiles = readdirSync(genomesDir)
    .filter((name) => /^gen-\d+\.json$/.test(name))
    .sort()

  const entries = genomeFiles.map((name) => {
    const pathname = join(genomesDir, name)
    const generation = parseGenerationNumber(pathname)
    return { pathname, generation }
  })
  const validEntries = entries.filter(
    (entry): entry is { pathname: string; generation: number } =>
      entry.generation != null
  )
  if (validEntries.length === 0) return []

  const fitnessByGeneration = loadGenerationFitnessMap(labPath)
  const byGeneration = new Map<number, string>(
    validEntries.map((entry) => [entry.generation, entry.pathname])
  )
  const orderedGenerations = [...byGeneration.keys()].sort((a, b) => a - b)

  if (orderedGenerations.length <= heroCount) {
    return orderedGenerations
      .map((generation) => byGeneration.get(generation))
      .filter((pathname): pathname is string => pathname != null)
  }

  const selected = new Set<string>()
  const tryAddGeneration = (generation: number | null | undefined) => {
    if (generation == null) return
    const pathname = byGeneration.get(generation)
    if (pathname != null) selected.add(pathname)
  }

  tryAddGeneration(orderedGenerations[0])
  tryAddGeneration(orderedGenerations[orderedGenerations.length - 1])

  const fitnessBands = [0.05, 0.1, 0.15, 0.2]
  for (const threshold of fitnessBands) {
    const match = orderedGenerations.find((generation) => {
      const fitness = fitnessByGeneration.get(generation)
      return Number.isFinite(fitness) && (fitness ?? 0) >= threshold
    })
    tryAddGeneration(match)
  }

  const jumps: Array<{ generation: number; delta: number }> = []
  for (let i = 1; i < orderedGenerations.length; i++) {
    const prevGeneration = orderedGenerations[i - 1]
    const generation = orderedGenerations[i]
    if (prevGeneration == null || generation == null) continue
    const prevFitness = fitnessByGeneration.get(prevGeneration) ?? 0
    const fitness = fitnessByGeneration.get(generation) ?? 0
    jumps.push({ generation, delta: fitness - prevFitness })
  }
  jumps.sort((a, b) => b.delta - a.delta)
  for (const jump of jumps) {
    if (selected.size >= heroCount) break
    if (jump.delta > 0) tryAddGeneration(jump.generation)
  }

  if (selected.size < heroCount) {
    const fallbackIndices = pickSampleIndices(
      orderedGenerations.length,
      heroCount
    )
    for (const index of fallbackIndices) {
      if (selected.size >= heroCount) break
      tryAddGeneration(orderedGenerations[index])
    }
  }

  return [...selected]
    .map((pathname) => ({
      pathname,
      generation: parseGenerationNumber(pathname),
    }))
    .sort((a, b) => (a.generation ?? -1) - (b.generation ?? -1))
    .slice(0, heroCount)
    .map((entry) => entry.pathname)
}

function safeGenomeDescriptor(serialized: unknown): {
  generation: number | null
  fitness: number | null
} {
  if (!isRecord(serialized) || !isRecord(serialized.organismState)) {
    return { generation: null, fitness: null }
  }

  const organismState = serialized.organismState
  const generation = Number(organismState.generation)
  const fitness = Number(organismState.fitness)
  return {
    generation: Number.isFinite(generation) ? generation : null,
    fitness: Number.isFinite(fitness) ? fitness : null,
  }
}

export function discoverSourceGenomes(options: ScenarioOptions): SourceReport {
  const labs = listRecentLabs(options.labRoot, options.maxLabs)
  const generationKinds = new Set<SourceKind>()
  const rejected: RejectedSource[] = []
  const discovered: SourceGenome[] = []

  for (const labPath of labs) {
    const labId = basename(labPath)
    const fitnessByGeneration = loadGenerationFitnessMap(labPath)
    const labConfig = readLabConfig(labPath)

    const bestPaths = readdirSync(labPath)
      .filter((name) => name.startsWith('best-') && name.endsWith('.json'))
      .sort()
      .map((name) => join(labPath, name))

    const sourcePaths: Array<{ pathname: string; kind: SourceKind }> = [
      ...bestPaths.map((pathname) => ({
        pathname,
        kind: 'best-of-lab' as const,
      })),
      ...sampleHeroGenomePaths(labPath, options.heroCount).map((pathname) => ({
        pathname,
        kind: 'hero-gen' as const,
      })),
    ]

    for (const source of sourcePaths) {
      let serialized: unknown
      try {
        serialized = readJson(source.pathname)
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error)
        rejected.push({
          pathname: source.pathname,
          reason: `failed to read JSON: ${reason}`,
        })
        continue
      }

      const io = genomeIoShape(serialized)
      const inferredEncodingPreset =
        io != null ? inferEncodingPreset(io.inputs) : null
      if (!isCompatibleGenome(serialized)) {
        rejected.push({
          pathname: source.pathname,
          reason:
            io == null
              ? 'missing initConfig inputs/outputs'
              : `incompatible io ${io.inputs}/${io.outputs}`,
        })
        continue
      }

      const descriptor = safeGenomeDescriptor(serialized)
      const generation =
        descriptor.generation ?? parseGenerationNumber(source.pathname)
      const measuredFitness =
        descriptor.fitness ??
        (generation != null
          ? (fitnessByGeneration.get(generation) ?? null)
          : null)

      generationKinds.add(source.kind)
      discovered.push({
        id: `${labId}:${source.kind}:${basename(source.pathname)}`,
        labId,
        kind: source.kind,
        genomePath: source.pathname,
        method: labConfig.method,
        encodingPreset: inferredEncodingPreset ?? labConfig.encodingPreset,
        generation,
        measuredFitness,
        io,
      })
    }
  }

  discovered.sort((a, b) => {
    if (a.labId !== b.labId) return a.labId < b.labId ? 1 : -1
    if (a.kind !== b.kind) return a.kind < b.kind ? -1 : 1
    return (a.generation ?? -1) - (b.generation ?? -1)
  })

  return {
    sources: discovered,
    rejected,
    kinds: [...generationKinds].sort(),
  }
}
