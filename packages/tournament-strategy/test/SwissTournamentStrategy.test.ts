import type { EvaluationContext } from '@neat-evolution/evaluation-strategy'
import type {
  FitnessData,
  GenomeEntries,
  GenomeEntry,
} from '@neat-evolution/evaluator'
import { beforeEach, describe, expect, test, vi } from 'vitest'

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
      dispatch: vi.fn(),
      request: vi.fn(),
      broadcast: vi.fn(),
      addActionHandler: vi.fn(),
      removeActionHandler: vi.fn(),
    } as unknown as EvaluationContext<any>
    mockGenomeEntries = [
      [1, 1, {}] as GenomeEntry<any>,
      [1, 2, {}] as GenomeEntry<any>,
      [2, 3, {}] as GenomeEntry<any>,
      [3, 4, {}] as GenomeEntry<any>,
    ]
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

    const mockContextWithSeeding = {
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
      dispatch: vi.fn(),
      request: vi.fn(),
      broadcast: vi.fn(),
      addActionHandler: vi.fn(),
      removeActionHandler: vi.fn(),
    } as unknown as EvaluationContext<any>

    const yieldedFitnessData: FitnessData[] = []
    for await (const fitnessData of seedingStrategy.evaluate(
      mockContextWithSeeding,
      mockGenomeEntries
    )) {
      yieldedFitnessData.push(fitnessData)
    }

    // Verify individual evaluation was called for each genome
    expect(mockContextWithSeeding.evaluateGenomeEntry).toHaveBeenCalledTimes(
      [...mockGenomeEntries].length
    )

    // Verify results were returned for all genomes
    expect(yieldedFitnessData).toHaveLength([...mockGenomeEntries].length)
  })

  test('uses default weighted scoring to combine all components', async () => {
    const strategy = new SwissTournamentStrategy({
      rounds: 2,
      individualSeeding: true,
    })

    // Mock context with both individual and batch evaluation
    const mockContextWithSeeding = {
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
      dispatch: vi.fn(),
      request: vi.fn(),
      broadcast: vi.fn(),
      addActionHandler: vi.fn(),
      removeActionHandler: vi.fn(),
    } as unknown as EvaluationContext<any>

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
    expect(results).toHaveLength([...mockGenomeEntries].length)

    // All fitness values should be valid
    for (const [, , fitness] of results) {
      expect(fitness).toBeGreaterThanOrEqual(0)
      expect(fitness).toBeLessThanOrEqual(1)
    }
  })
})
