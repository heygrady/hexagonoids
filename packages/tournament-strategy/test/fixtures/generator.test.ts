import { writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import type { EvaluationContext } from '@neat-evolution/evaluation-strategy'
import type { AnyGenome, GenomeEntry } from '@neat-evolution/evaluator'
import { test, expect, vi } from 'vitest'

import { toId } from '../../src/entities/toId.js'
import { GlickoStrategy } from '../../src/GlickoStrategy.js'

import type {
  GlickoEvaluationFixture,
  GlickoResultData,
  GlickoHeroData,
} from './types.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

/**
 * FIXTURE GENERATOR TESTS
 *
 * These tests are marked as .skip and generate JSON fixtures for unit tests.
 * To regenerate fixtures:
 * 1. Remove .skip from the test you want to run
 * 2. Run: yarn test test/fixtures/generator.test.ts
 * 3. Add .skip back after fixture is saved
 * 4. Commit the generated JSON file
 */

test.skip('generate fixture: 1 generation evaluation', async () => {
  const config = {
    matchPlayerSize: 2,
    rounds: 3,
    individualSeeding: true,
    heroPoolRatio: 0.3,
    minScore: -0.375,
    maxScore: 4.5,
    normalizationRanges: {
      glickoRating: { min: 800, max: 3000 },
      conservativeRating: { min: 0, max: 2500 },
      innovationBonus: { min: 0, max: 500 },
    },
  }

  const populationSize = 20
  const strategy = new GlickoStrategy(config)

  // Create deterministic mock context
  const mockContext: EvaluationContext<AnyGenome> = {
    evaluateGenomeEntry: vi.fn(async (entry: GenomeEntry<AnyGenome>) => {
      const fitness =
        (entry[1] / populationSize) * (config.maxScore - config.minScore) +
        config.minScore
      return [entry[0], entry[1], fitness]
    }),
    evaluateGenomeEntryBatch: vi.fn(
      async (entries: Array<GenomeEntry<AnyGenome>>) => {
        if (entries.length === 2) {
          const [entryA, entryB] = entries
          if (entryA == null || entryB == null) return []

          const indexA = entryA[1]
          const indexB = entryB[1]

          const fitnessA = indexA > indexB ? 3 : indexA === indexB ? 1 : -0.25
          const fitnessB = indexB > indexA ? 3 : indexB === indexA ? 1 : -0.25

          return [
            [entryA[0], entryA[1], fitnessA],
            [entryB[0], entryB[1], fitnessB],
          ]
        }
        return entries.map((e) => [e[0], e[1], 0])
      }
    ),
  }

  const genomes: Array<GenomeEntry<AnyGenome>> = Array.from(
    { length: populationSize },
    (_, i) => [0, i, { id: i, neurons: [], connections: [] }]
  )

  let capturedHeroes: Array<[GenomeEntry<AnyGenome>, any]> = []
  strategy.options.onHeroesUpdated = (newHeroes) => {
    capturedHeroes = newHeroes
  }

  // Run evaluation and capture results
  const results: GlickoResultData[] = []

  for await (const fitnessData of strategy.evaluate(mockContext, genomes)) {
    const [speciesIndex, organismIndex, fitness] = fitnessData
    const entryId = toId([speciesIndex, organismIndex, {}])

    // We can't access internal state directly, so we'll create placeholder data
    // In real usage, we'd instrument the code or use debug output
    results.push({
      entryId,
      speciesIndex,
      organismIndex,
      fitness,
      components: {
        seedScore: 0.5, // Placeholder - would need to capture from strategy
        environmentScore: 0.5,
        glickoScore: 0.5,
        conservativeScore: 0.4,
        innovationScore: 0,
      },
      rawData: {
        glickoRating: 1500,
        glickoRd: 350,
        glickoVol: 0.06,
        environmentTotal: 0,
        environmentCount: 1,
      },
    })
  }

  const heroes: GlickoHeroData[] = capturedHeroes.map(
    ([entry, glickoData]) => ({
      generation: 1,
      entryId: toId(entry),
      rating: glickoData.rating,
      rd: glickoData.rd,
      vol: glickoData.vol,
    })
  )

  const fixture: GlickoEvaluationFixture = {
    timestamp: new Date().toISOString(),
    generation: 1,
    populationSize,
    config,
    results,
    heroes,
  }

  const fixturePath = join(__dirname, 'glicko-scoring-gen1.json')
  await writeFile(fixturePath, JSON.stringify(fixture, null, 2))

  console.log(`✅ Fixture saved to: ${fixturePath}`)
  expect(results.length).toBe(populationSize)
})

test.skip('generate fixture: 3 generation progression', async () => {
  const config = {
    matchPlayerSize: 2,
    rounds: 2,
    individualSeeding: true,
    heroPoolRatio: 0.3,
    minScore: -0.375,
    maxScore: 4.5,
    normalizationRanges: {
      glickoRating: { min: 800, max: 3000 },
      conservativeRating: { min: 0, max: 2500 },
      innovationBonus: { min: 0, max: 500 },
    },
  }

  const populationSize = 20
  const strategy = new GlickoStrategy(config)

  const mockContext: EvaluationContext<AnyGenome> = {
    evaluateGenomeEntry: vi.fn(async (entry: GenomeEntry<AnyGenome>) => {
      const fitness =
        (entry[1] / populationSize) * (config.maxScore - config.minScore) +
        config.minScore
      return [entry[0], entry[1], fitness]
    }),
    evaluateGenomeEntryBatch: vi.fn(
      async (entries: Array<GenomeEntry<AnyGenome>>) => {
        if (entries.length === 2) {
          const [entryA, entryB] = entries
          if (entryA == null || entryB == null) return []

          const indexA = entryA[1]
          const indexB = entryB[1]

          const fitnessA = indexA > indexB ? 3 : indexA === indexB ? 1 : -0.25
          const fitnessB = indexB > indexA ? 3 : indexB === indexA ? 1 : -0.25

          return [
            [entryA[0], entryA[1], fitnessA],
            [entryB[0], entryB[1], fitnessB],
          ]
        }
        return entries.map((e) => [e[0], e[1], 0])
      }
    ),
  }

  let finalResults: GlickoResultData[] = []
  let finalHeroes: GlickoHeroData[] = []

  // Run 3 generations
  for (let gen = 0; gen < 3; gen++) {
    const genomes: Array<GenomeEntry<AnyGenome>> = Array.from(
      { length: populationSize },
      (_, i) => [0, i, { id: i + gen * 100, neurons: [], connections: [] }]
    )

    let capturedHeroes: Array<[GenomeEntry<AnyGenome>, any]> = []
    strategy.options.onHeroesUpdated = (newHeroes) => {
      capturedHeroes = newHeroes
    }

    const results: GlickoResultData[] = []

    for await (const fitnessData of strategy.evaluate(mockContext, genomes)) {
      const [speciesIndex, organismIndex, fitness] = fitnessData
      const entryId = toId([speciesIndex, organismIndex, {}])

      results.push({
        entryId,
        speciesIndex,
        organismIndex,
        fitness,
        components: {
          seedScore: 0.5,
          environmentScore: 0.5,
          glickoScore: 0.5 + gen * 0.1, // Simulate improvement
          conservativeScore: 0.4 + gen * 0.05,
          innovationScore: gen > 0 ? 0.1 : 0, // Innovation after gen 0
        },
        rawData: {
          glickoRating: 1500 + gen * 100,
          glickoRd: 350 - gen * 20,
          glickoVol: 0.06,
          environmentTotal: 0,
          environmentCount: 1,
          previousRating: gen > 0 ? 1500 + (gen - 1) * 100 : undefined,
        },
      })
    }

    if (gen === 2) {
      finalResults = results
      finalHeroes = capturedHeroes.map(([entry, glickoData]) => ({
        generation: gen,
        entryId: toId(entry),
        rating: glickoData.rating,
        rd: glickoData.rd,
        vol: glickoData.vol,
      }))
    }
  }

  const fixture: GlickoEvaluationFixture = {
    timestamp: new Date().toISOString(),
    generation: 3,
    populationSize,
    config,
    results: finalResults,
    heroes: finalHeroes,
  }

  const fixturePath = join(__dirname, 'glicko-scoring-gen3.json')
  await writeFile(fixturePath, JSON.stringify(fixture, null, 2))

  console.log(`✅ Fixture saved to: ${fixturePath}`)
  expect(finalResults.length).toBe(populationSize)
})
