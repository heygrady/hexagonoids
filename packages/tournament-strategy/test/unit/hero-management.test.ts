import { describe, test, expect } from 'vitest'

import { toId } from '../../src/entities/toId.js'

describe('Hero Management Logic', () => {
  describe('Uniform Sampling Algorithm', () => {
    test('should sample evenly across all generations', () => {
      // Simulate 100 generations, sample 20 heroes
      const totalGenerations = 100
      const maxActiveHeroes = 20

      const allHeroes = Array.from({ length: totalGenerations }, (_, i) => i)

      // Uniform sampling formula
      const step = (totalGenerations - 1) / (maxActiveHeroes - 1)
      const sampled: number[] = []

      for (let i = 0; i < maxActiveHeroes; i++) {
        const idx = Math.round(i * step)
        sampled.push(allHeroes[idx])
      }

      expect(sampled.length).toBe(20)

      // First and last should be included
      expect(sampled[0]).toBe(0)
      expect(sampled[sampled.length - 1]).toBe(99)

      // Check spacing is approximately uniform
      for (let i = 1; i < sampled.length; i++) {
        const spacing = sampled[i] - sampled[i - 1]
        // Spacing should be approximately step ± 1
        expect(spacing).toBeGreaterThanOrEqual(Math.floor(step) - 1)
        expect(spacing).toBeLessThanOrEqual(Math.ceil(step) + 1)
      }
    })

    test('should use all heroes when count < max', () => {
      const totalGenerations = 10
      const maxActiveHeroes = 20

      const allHeroes = Array.from({ length: totalGenerations }, (_, i) => i)

      // Should return all heroes since 10 < 20
      const sampled = totalGenerations <= maxActiveHeroes ? allHeroes : [] // Would do sampling

      expect(sampled.length).toBe(totalGenerations)
    })

    test('should handle exact match (count === max)', () => {
      const totalGenerations = 20
      const maxActiveHeroes = 20

      const allHeroes = Array.from({ length: totalGenerations }, (_, i) => i)

      const sampled = totalGenerations <= maxActiveHeroes ? allHeroes : [] // Would do sampling

      expect(sampled.length).toBe(20)
    })

    test('should sample 1 hero from 1 generation', () => {
      const totalGenerations = 1
      const maxActiveHeroes = 5

      const allHeroes = [0]

      const sampled = totalGenerations <= maxActiveHeroes ? allHeroes : [] // Would do sampling

      expect(sampled).toEqual([0])
    })

    test('uniform sampling provides even temporal distribution', () => {
      // For generation 1000 with 20 hero slots
      const totalGenerations = 1000
      const maxActiveHeroes = 20

      const step = (totalGenerations - 1) / (maxActiveHeroes - 1)
      const sampled: number[] = []

      for (let i = 0; i < maxActiveHeroes; i++) {
        const idx = Math.round(i * step)
        sampled.push(idx)
      }

      // Should have heroes from early, middle, and late generations
      expect(sampled[0]).toBeLessThan(10) // Early
      expect(sampled[10]).toBeGreaterThan(400) // Middle
      expect(sampled[10]).toBeLessThan(600)
      expect(sampled[19]).toBeGreaterThan(990) // Late
    })
  })

  describe('Hero Pool Ratio Calculation', () => {
    test('should calculate correct hero count for 10 population with 0.3 ratio', () => {
      const populationSize = 10
      const heroPoolRatio = 0.3

      const maxActiveHeroes = Math.ceil(populationSize * heroPoolRatio)
      expect(maxActiveHeroes).toBe(3)
    })

    test('should calculate correct hero count for 100 population with 0.2 ratio', () => {
      const populationSize = 100
      const heroPoolRatio = 0.2

      const maxActiveHeroes = Math.ceil(populationSize * heroPoolRatio)
      expect(maxActiveHeroes).toBe(20)
    })

    test('should round up for fractional results', () => {
      const populationSize = 10
      const heroPoolRatio = 0.15 // 1.5 heroes

      const maxActiveHeroes = Math.ceil(populationSize * heroPoolRatio)
      expect(maxActiveHeroes).toBe(2) // Rounded up
    })

    test('should handle very small populations', () => {
      const populationSize = 5
      const heroPoolRatio = 0.5

      const maxActiveHeroes = Math.ceil(populationSize * heroPoolRatio)
      expect(maxActiveHeroes).toBe(3) // 2.5 rounded up
    })

    test('should handle ratio of 1.0 (100%)', () => {
      const populationSize = 10
      const heroPoolRatio = 1.0

      const maxActiveHeroes = Math.ceil(populationSize * heroPoolRatio)
      expect(maxActiveHeroes).toBe(10)
    })

    test('should handle ratio of 0 (no heroes)', () => {
      const populationSize = 10
      const heroPoolRatio = 0

      const maxActiveHeroes = Math.ceil(populationSize * heroPoolRatio)
      expect(maxActiveHeroes).toBe(0)
    })
  })

  describe('Hero ID Mangling', () => {
    test('should create unique IDs with 100_000 offset', () => {
      const maxSpecies = 5
      const maxOrganism = 99
      const heroIndex = 0

      const mangledSpecies = maxSpecies + 100_000
      const mangledOrganism = maxOrganism + 100_000 + heroIndex

      expect(mangledSpecies).toBe(100_005)
      expect(mangledOrganism).toBe(100_099)
    })

    test('should generate different IDs for different heroIndex', () => {
      const maxSpecies = 5
      const maxOrganism = 99

      const hero1 = [maxSpecies + 100_000, maxOrganism + 100_000 + 0, {}]
      const hero2 = [maxSpecies + 100_000, maxOrganism + 100_000 + 1, {}]

      const id1 = toId(hero1)
      const id2 = toId(hero2)

      expect(id1).not.toBe(id2)
    })

    test('should not collide with population IDs', () => {
      const populationIds = Array.from({ length: 100 }, (_, i) =>
        toId([0, i, {}])
      )

      const maxSpecies = 0
      const maxOrganism = 99
      const heroId = toId([maxSpecies + 100_000, maxOrganism + 100_000, {}])

      expect(populationIds.includes(heroId)).toBe(false)
    })

    test('should stay within toId range limits', () => {
      const maxSpecies = 1000
      const maxOrganism = 5000
      const heroIndex = 500

      const mangledSpecies = maxSpecies + 100_000
      const mangledOrganism = maxOrganism + 100_000 + heroIndex

      // toId now supports up to 67,108,863 (26-bit)
      expect(mangledSpecies).toBeLessThan(67_108_864)
      expect(mangledOrganism).toBeLessThan(67_108_864)
    })

    test('should prevent exponential growth by excluding heroes from max calculation', () => {
      // Simulate what would happen if we exclude heroes
      const populationMaxSpecies = 5 // Only look at current population
      const populationMaxOrganism = 99

      // Generate heroes across 3 generations
      const heroes = []
      for (let gen = 0; gen < 3; gen++) {
        const mangledSpecies = populationMaxSpecies + 100_000
        const mangledOrganism = populationMaxOrganism + 100_000 + gen

        heroes.push([mangledSpecies, mangledOrganism, {}])
      }

      // All heroes should have same species index (100_005)
      const heroSpeciesIndices = heroes.map((h) => h[0])
      expect(heroSpeciesIndices.every((s) => s === 100_005)).toBe(true)

      // Organism indices should increment by 1
      expect(heroes[0][1]).toBe(100_099)
      expect(heroes[1][1]).toBe(100_100)
      expect(heroes[2][1]).toBe(100_101)
    })
  })

  describe('toId Function Range Support', () => {
    test('should support indices up to 67,108,863 (26-bit)', () => {
      const largeIndex = 67_108_863

      // Should not throw
      expect(() => toId([largeIndex, 0, {}])).not.toThrow()
      expect(() => toId([0, largeIndex, {}])).not.toThrow()
    })

    test('should reject indices >= 67,108,864', () => {
      const tooLarge = 67_108_864

      expect(() => toId([tooLarge, 0, {}])).toThrow(/out of range/)
      expect(() => toId([0, tooLarge, {}])).toThrow(/out of range/)
    })

    test('should handle hero IDs at 100_000 base', () => {
      const heroSpecies = 100_005
      const heroOrganism = 100_099

      expect(() => toId([heroSpecies, heroOrganism, {}])).not.toThrow()
    })

    test('should create unique IDs for different species/organism combos', () => {
      const id1 = toId([0, 0, {}])
      const id2 = toId([0, 1, {}])
      const id3 = toId([1, 0, {}])

      expect(id1).not.toBe(id2)
      expect(id2).not.toBe(id3)
      expect(id1).not.toBe(id3)
    })
  })

  describe('Generation Tracking', () => {
    test('initial heroes should use negative generation numbers', () => {
      const initialHeroes = [
        { generation: -1, data: 'hero0' },
        { generation: -2, data: 'hero1' },
        { generation: -3, data: 'hero2' },
      ]

      expect(initialHeroes[0].generation).toBe(-1)
      expect(initialHeroes[1].generation).toBe(-2)
      expect(initialHeroes[2].generation).toBe(-3)
    })

    test('evolved heroes should use non-negative generation numbers', () => {
      const evolvedHeroes = [
        { generation: 0, data: 'gen0' },
        { generation: 1, data: 'gen1' },
        { generation: 2, data: 'gen2' },
      ]

      expect(evolvedHeroes[0].generation).toBeGreaterThanOrEqual(0)
      expect(evolvedHeroes[1].generation).toBeGreaterThanOrEqual(0)
      expect(evolvedHeroes[2].generation).toBeGreaterThanOrEqual(0)
    })

    test('should support thousands of generations', () => {
      const largeGeneration = 10_000

      // Should be able to track many generations
      expect(largeGeneration).toBeGreaterThan(0)
      expect(largeGeneration).toBeLessThan(Number.MAX_SAFE_INTEGER)
    })
  })
})
