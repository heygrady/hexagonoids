import type { EvaluationContext } from '@neat-evolution/evaluation-strategy'
import type {
  GenomeEntries,
  FitnessData,
  GenomeEntry,
} from '@neat-evolution/evaluator'
import { describe, expect, test, vi, beforeEach } from 'vitest'

import { SwissTournamentStrategy } from '../src/index.js'

describe('SwissTournamentStrategy', () => {
  let strategy: SwissTournamentStrategy<any>
  let mockContext: EvaluationContext<any>
  let mockGenomeEntries: GenomeEntries<any>

  beforeEach(() => {
    strategy = new SwissTournamentStrategy()
    mockContext = {
      evaluateGenomeEntry: vi.fn(),
      evaluateGenomeEntryBatch: vi
        .fn()
        .mockImplementation(async (entries: Array<GenomeEntry<any>>) => {
          // Mock returns fitness data for each genome in the batch
          // Simulating game results: winner gets 3, loser gets -0.25
          return entries.map((entry, index) => {
            const [speciesIndex, organismIndex] = entry
            const score = index === 0 ? 3 : -0.25 // First player wins
            return [speciesIndex, organismIndex, score] as FitnessData
          })
        }),
    }
    mockGenomeEntries = [
      [1, 1, {}] as GenomeEntry<any>,
      [1, 2, {}] as GenomeEntry<any>,
      [2, 3, {}] as GenomeEntry<any>,
      [3, 4, {}] as GenomeEntry<any>,
    ]
  })

  test('should be defined', () => {
    expect(strategy).toBeDefined()
  })

  test('should implement EvaluationStrategy interface', () => {
    expect(strategy.options).toBeDefined()
    expect(strategy.options.matchPlayerSize).toBe(2)
    expect(strategy.options.minScore).toBe(-0.25)
    expect(strategy.options.maxScore).toBe(3)
    expect(typeof strategy.evaluate).toBe('function')
  })

  test('should accept custom options', () => {
    const customStrategy = new SwissTournamentStrategy({
      matchPlayerSize: 3,
      rounds: 5,
      minScore: 0,
      maxScore: 10,
      individualSeeding: true,
    })

    expect(customStrategy.options.matchPlayerSize).toBe(3)
    expect(customStrategy.options.rounds).toBe(5)
    expect(customStrategy.options.minScore).toBe(0)
    expect(customStrategy.options.maxScore).toBe(10)
    expect(customStrategy.options.individualSeeding).toBe(true)
  })

  test('should yield FitnessData for each genome entry', async () => {
    const yieldedFitnessData: FitnessData[] = []
    for await (const fitnessData of strategy.evaluate(
      mockContext,
      mockGenomeEntries
    )) {
      yieldedFitnessData.push(fitnessData)
    }

    expect(yieldedFitnessData).toHaveLength(
      Array.from(mockGenomeEntries).length
    )

    for (const data of yieldedFitnessData) {
      expect(data).toHaveLength(3) // [speciesIndex, organismIndex, fitness]
      expect(typeof data[0]).toBe('number') // speciesIndex
      expect(typeof data[1]).toBe('number') // organismIndex
      expect(typeof data[2]).toBe('number') // fitness
      expect(data[2]).toBeGreaterThanOrEqual(0)
      expect(data[2]).toBeLessThanOrEqual(1)
    }

    // Verify that batch evaluation was called (for tournament matches)
    expect(mockContext.evaluateGenomeEntryBatch).toHaveBeenCalled()
  })

  test('should evaluate individually for seeding when option is enabled', async () => {
    const seedingStrategy = new SwissTournamentStrategy({
      individualSeeding: true,
    })

    const mockContextWithSeeding: EvaluationContext<any> = {
      evaluateGenomeEntry: vi.fn().mockImplementation(async (entry) => {
        const [speciesIndex, organismIndex] = entry
        // Return individual fitness scores
        return [speciesIndex, organismIndex, 0.5] as FitnessData
      }),
      evaluateGenomeEntryBatch: vi
        .fn()
        .mockImplementation(async (entries: Array<GenomeEntry<any>>) => {
          return entries.map((entry, index) => {
            const [speciesIndex, organismIndex] = entry
            const score = index === 0 ? 3 : -0.25
            return [speciesIndex, organismIndex, score] as FitnessData
          })
        }),
    }

    const yieldedFitnessData: FitnessData[] = []
    for await (const fitnessData of seedingStrategy.evaluate(
      mockContextWithSeeding,
      mockGenomeEntries
    )) {
      yieldedFitnessData.push(fitnessData)
    }

    // Verify individual evaluation was called for each genome
    expect(mockContextWithSeeding.evaluateGenomeEntry).toHaveBeenCalledTimes(
      mockGenomeEntries.length
    )

    // Verify results were returned for all genomes
    expect(yieldedFitnessData).toHaveLength(mockGenomeEntries.length)
  })

  test('calculateBuchholzScores sums opponents tournament scores', () => {
    const entryA: GenomeEntry<any> = [0, 0, {}]
    const entryB: GenomeEntry<any> = [0, 1, {}]
    const entryC: GenomeEntry<any> = [0, 2, {}]
    const entryD: GenomeEntry<any> = [0, 3, {}]
    const entries: Array<GenomeEntry<any>> = [entryA, entryB, entryC, entryD]

    // Tournament scores after all rounds
    const tournamentScores = new Map([
      [0, 3.0], // A: 3 wins
      [1, 2.0], // B: 2 wins
      [2, 1.0], // C: 1 win
      [3, 0.0], // D: 0 wins
    ])

    // Helper to create entry ID (matches toId implementation)
    const toId = (entry: GenomeEntry<any>): number =>
      (entry[0] << 16) | entry[1]

    // Opponent relationships
    const previousOpponents = new Map([
      [toId(entryA), new Set([toId(entryB), toId(entryC)])], // A faced B, C
      [toId(entryB), new Set([toId(entryA), toId(entryD)])], // B faced A, D
      [toId(entryC), new Set([toId(entryA), toId(entryD)])], // C faced A, D
      [toId(entryD), new Set([toId(entryB), toId(entryC)])], // D faced B, C
    ])

    const buchholz = strategy['calculateBuchholzScores'](
      tournamentScores,
      previousOpponents,
      entries
    )

    // A faced B(2.0) + C(1.0) = 3.0
    expect(buchholz.get(0)).toBe(3.0)

    // B faced A(3.0) + D(0.0) = 3.0
    expect(buchholz.get(1)).toBe(3.0)

    // C faced A(3.0) + D(0.0) = 3.0
    expect(buchholz.get(2)).toBe(3.0)

    // D faced B(2.0) + C(1.0) = 3.0
    expect(buchholz.get(3)).toBe(3.0)
  })

  test('calculateBuchholzScores includes filler opponents but not filler itself', () => {
    const entryA: GenomeEntry<any> = [0, 0, {}]
    const entryB: GenomeEntry<any> = [0, 1, {}]
    const entryC: GenomeEntry<any> = [0, 2, {}]
    const entryFiller: GenomeEntry<any> = [1, 3, {}] // Filler (synthetic ID)
    const entries: Array<GenomeEntry<any>> = [
      entryA,
      entryB,
      entryC,
      entryFiller,
    ]

    // Helper to create entry ID
    const toId = (entry: GenomeEntry<any>): number =>
      (entry[0] << 16) | entry[1]

    // Mark filler
    strategy['fillerIds'].add(toId(entryFiller))

    const tournamentScores = new Map([
      [0, 2.0], // A
      [1, 1.0], // B
      [2, 0.5], // C
      [3, 0.0], // Filler
    ])

    const previousOpponents = new Map([
      [toId(entryA), new Set([toId(entryB), toId(entryFiller)])], // A faced B + filler
      [toId(entryB), new Set([toId(entryA), toId(entryC)])], // B faced A, C
      [toId(entryC), new Set([toId(entryB), toId(entryFiller)])], // C faced B + filler
      [toId(entryFiller), new Set([toId(entryA), toId(entryC)])], // Filler faced A, C
    ])

    const buchholz = strategy['calculateBuchholzScores'](
      tournamentScores,
      previousOpponents,
      entries
    )

    // A faced B(1.0) + Filler(0.0) = 1.0 (filler included but scored 0)
    expect(buchholz.get(0)).toBe(1.0)

    // B faced A(2.0) + C(0.5) = 2.5
    expect(buchholz.get(1)).toBe(2.5)

    // C faced B(1.0) + Filler(0.0) = 1.0 (filler included but scored 0)
    expect(buchholz.get(2)).toBe(1.0)

    // Filler's own Buchholz should not be calculated (it's not a real genome)
    expect(buchholz.has(3)).toBe(false)
  })

  test('uses default weighted scoring to combine all components', async () => {
    const strategy = new SwissTournamentStrategy({
      rounds: 2,
      individualSeeding: true,
    })

    // Mock context with both individual and batch evaluation
    const mockContextWithSeeding: EvaluationContext<any> = {
      evaluateGenomeEntry: vi.fn().mockImplementation(async (entry) => {
        const [speciesIndex, organismIndex] = entry
        // All genomes get same seed score for simplicity
        return [speciesIndex, organismIndex, 0.5] as FitnessData
      }),
      evaluateGenomeEntryBatch: vi
        .fn()
        .mockImplementation(async (entries: Array<GenomeEntry<any>>) => {
          // First player in match always wins
          return entries.map((entry, index) => {
            const [speciesIndex, organismIndex] = entry
            const score = index === 0 ? 3 : -0.25
            return [speciesIndex, organismIndex, score] as FitnessData
          })
        }),
    }

    const entries: Array<GenomeEntry<any>> = [
      [0, 0, {}],
      [0, 1, {}],
      [0, 2, {}],
      [0, 3, {}],
    ]

    const results: FitnessData[] = []
    for await (const fitness of strategy.evaluate(
      mockContextWithSeeding,
      entries
    )) {
      results.push(fitness)
    }

    // All results should be in [0, 1] range
    for (const [, , fitness] of results) {
      expect(fitness).toBeGreaterThanOrEqual(0)
      expect(fitness).toBeLessThanOrEqual(1)
    }

    // Verify some variation in fitness (not all identical)
    const fitnessValues = results.map((r) => r[2])
    const uniqueValues = new Set(fitnessValues)
    expect(uniqueValues.size).toBeGreaterThan(1)
  })

  test('accepts custom fitness calculator', async () => {
    // Custom calculator that only uses tournament score
    const customCalculator = vi.fn((components) => {
      return components.tournamentScore
    })

    const strategy = new SwissTournamentStrategy({
      rounds: 2,
      fitnessCalculator: customCalculator,
    })

    const results: FitnessData[] = []
    for await (const fitness of strategy.evaluate(
      mockContext,
      mockGenomeEntries
    )) {
      results.push(fitness)
    }

    // Verify custom calculator was called
    expect(customCalculator).toHaveBeenCalled()

    // Verify fitness values are in valid range
    for (const [, , fitness] of results) {
      expect(fitness).toBeGreaterThanOrEqual(0)
      expect(fitness).toBeLessThanOrEqual(1)
    }
  })

  test('handles missing seed score gracefully when individualSeeding is false', async () => {
    const strategy = new SwissTournamentStrategy({
      rounds: 2,
      individualSeeding: false, // No seed score
    })

    const results: FitnessData[] = []
    for await (const fitness of strategy.evaluate(
      mockContext,
      mockGenomeEntries
    )) {
      results.push(fitness)
    }

    // Should complete without errors
    expect(results).toHaveLength(Array.from(mockGenomeEntries).length)

    // All fitness values should be valid
    for (const [, , fitness] of results) {
      expect(fitness).toBeGreaterThanOrEqual(0)
      expect(fitness).toBeLessThanOrEqual(1)
    }
  })
})
