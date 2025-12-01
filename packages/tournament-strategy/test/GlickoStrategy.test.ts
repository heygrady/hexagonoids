import type { EvaluationContext } from '@neat-evolution/evaluation-strategy'
import type {
  AnyGenome,
  FitnessData,
  GenomeEntry,
} from '@neat-evolution/evaluator'
import { describe, test, expect, vi } from 'vitest'

import * as glickoScoreSeedTournaments from '../src/glicko/scoreSeedTournaments.js'
import { GlickoStrategy } from '../src/GlickoStrategy.js'

vi.mock('../src/glicko/scoreSeedTournaments.js', async (importOriginal) => {
  const actual = await importOriginal<typeof glickoScoreSeedTournaments>()
  return {
    ...actual,
    // @ts-expect-error mocking only evaluateIndividually
    evaluateIndividually: vi.fn(actual.evaluateIndividually),
  }
})

describe('GlickoStrategy', () => {
  const mockContext: EvaluationContext<AnyGenome<any>> = {
    evaluateGenomeEntry: vi.fn(
      async (entry: GenomeEntry<AnyGenome<any>>, _seed?: string) =>
        [entry[0], entry[1], Math.random()] as FitnessData
    ),
    evaluateGenomeEntryBatch: vi.fn(
      async (entries: Array<GenomeEntry<AnyGenome<any>>>, _seed?: string) => {
        const results: FitnessData[] = []
        for (const entry of entries) {
          results.push([entry[0], entry[1], Math.random()])
        }
        return results
      }
    ),
  }

  const mockGenomes: Array<GenomeEntry<AnyGenome<any>>> = Array.from(
    { length: 20 },
    (_, i) => [0, i, {} as unknown as AnyGenome<any>]
  )

  test('should be defined', () => {
    expect(GlickoStrategy).toBeDefined()
  })

  test('should implement EvaluationStrategy interface', () => {
    const strategy = new GlickoStrategy()
    expect(strategy.evaluate).toBeInstanceOf(Function)
  })

  test('should accept custom options', () => {
    const options = {
      matchPlayerSize: 4,
      rounds: 5,
    }
    const strategy = new GlickoStrategy(options)
    expect(strategy.options.matchPlayerSize).toBe(4)
    expect(strategy.options.rounds).toBe(5)
  })

  test('should yield FitnessData for each genome entry', async () => {
    const strategy = new GlickoStrategy()
    const fitnessData = []
    for await (const data of strategy.evaluate(mockContext, mockGenomes)) {
      fitnessData.push(data)
    }
    expect(fitnessData.length).toBe(mockGenomes.length)
    for (const data of fitnessData) {
      expect(data).toHaveLength(3)
      expect(typeof data[0]).toBe('number')
      expect(typeof data[1]).toBe('number')
      expect(typeof data[2]).toBe('number')
    }
  })

  test('should evaluate individually for seeding when option is enabled', async () => {
    const strategy = new GlickoStrategy({ individualSeeding: true })
    const spy = vi.spyOn(glickoScoreSeedTournaments, 'scoreSeedTournaments')

    for await (const _ of strategy.evaluate(mockContext, mockGenomes)) {
      // consume the async generator
    }

    expect(spy).toHaveBeenCalled()
  })

  test('should update hall of fame', async () => {
    const onHeroesUpdated = vi.fn()
    const strategy = new GlickoStrategy({ onHeroesUpdated })

    for await (const _ of strategy.evaluate(mockContext, mockGenomes)) {
      // consume the async generator
    }

    expect(onHeroesUpdated).toHaveBeenCalled()
  })

  test('should handle a larger population efficiently', async () => {
    const largeMockGenomes: Array<GenomeEntry<AnyGenome<any>>> = Array.from(
      { length: 100 },
      (_, i) => [i % 10, i, {} as unknown as AnyGenome<any>]
    )
    const strategy = new GlickoStrategy()
    const start = performance.now()
    for await (const _ of strategy.evaluate(mockContext, largeMockGenomes)) {
      // consume the async generator
    }
    const end = performance.now()
    expect(end - start).toBeLessThan(1000) // Should be fast enough
  })

  test('should use initial heroes', async () => {
    const initialHeroes: Array<
      [GenomeEntry<AnyGenome<any>>, { rating: number; rd: number; vol: number }]
    > = [
      [
        [100, 100, {} as unknown as AnyGenome<any>],
        { rating: 2000, rd: 50, vol: 0.06 },
      ],
    ]
    const strategy = new GlickoStrategy({ initialHeroes })
    const fitnessData = []
    for await (const data of strategy.evaluate(mockContext, mockGenomes)) {
      fitnessData.push(data)
    }
    expect(fitnessData.length).toBe(mockGenomes.length)
  })

  test('should create heroes with mangled IDs', async () => {
    const onHeroesUpdated = vi.fn()
    const strategy = new GlickoStrategy({
      onHeroesUpdated,
      heroPoolRatio: 0.5,
    })
    const genomes: Array<GenomeEntry<AnyGenome<any>>> = [
      [0, 0, {} as unknown as AnyGenome<any>],
      [0, 1, {} as unknown as AnyGenome<any>],
      [0, 2, {} as unknown as AnyGenome<any>],
      [0, 3, {} as unknown as AnyGenome<any>],
    ]
    for await (const _ of strategy.evaluate(mockContext, genomes)) {
      // consume the async generator
    }
    expect(onHeroesUpdated).toHaveBeenCalled()
    const heroes = onHeroesUpdated.mock.calls[0][0]
    expect(heroes.length).toBeGreaterThan(0)

    // Heroes should have mangled IDs (species index >= 100_000)
    for (const [entry] of heroes) {
      expect(entry[0]).toBeGreaterThanOrEqual(100_000)
    }
  })
})
