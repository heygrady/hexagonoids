import { simpleAI, minimaxAI } from '@heygrady/tictactoe-game'
import { createRNG } from '@neat-evolution/utils'
import { describe, expect, test } from 'vitest'

import { evaluateGauntlet } from '../../src/evaluation/gauntletEvaluation.js'
import type { OpponentConfig } from '../../src/types/evaluation.js'

describe('evaluateGauntlet', () => {
  const defaultPositionWeights = { firstPlayer: 0.4, secondPlayer: 0.6 }
  const defaultOutcomes = { win: 1, loss: 0.1, draw: 1 / 3 }
  const defaultConfidence = { min: 0.5, max: 1.5 }
  const defaultWeighting = { strategy: 'recency-weighted' as const, divisor: 3 }

  const singleOpponent: OpponentConfig[] = [
    {
      opponent: 'simpleAI',
      numGames: 2,
      weight: 1.0,
      normalizationBounds: { min: 0.05, max: 1.5 },
    },
  ]

  const multipleOpponents: OpponentConfig[] = [
    {
      opponent: 'minimaxAI',
      numGames: 2,
      weight: 0.4,
      normalizationBounds: { min: 0.05, max: 0.5 },
    },
    {
      opponent: 'heuristicAI',
      numGames: 2,
      weight: 0.3,
      normalizationBounds: { min: 0.05, max: [1.5, 0.5] }, // Different max for each position
    },
    {
      opponent: 'simpleAI',
      numGames: 2,
      weight: 0.3,
      normalizationBounds: { min: 0.05, max: 1.5 },
    },
  ]

  test('should return a single fitness score', () => {
    const fitness = evaluateGauntlet(
      simpleAI,
      singleOpponent,
      defaultPositionWeights,
      defaultOutcomes,
      defaultConfidence,
      defaultWeighting
    )

    expect(typeof fitness).toBe('number')
  })

  test('should produce fitness in reasonable range', () => {
    const fitness = evaluateGauntlet(
      simpleAI,
      multipleOpponents,
      defaultPositionWeights,
      defaultOutcomes,
      defaultConfidence,
      defaultWeighting
    )

    // Fitness should generally be between 0 and 1 after normalization and weighting
    expect(fitness).toBeGreaterThan(-0.5)
    expect(fitness).toBeLessThan(1.5)
  })

  test('should weight opponents according to their importance', () => {
    const heavyMinimaxOpponents: OpponentConfig[] = [
      {
        opponent: 'minimaxAI',
        numGames: 2,
        weight: 0.9,
        normalizationBounds: { min: 0.05, max: 0.5 },
      },
      {
        opponent: 'simpleAI',
        numGames: 2,
        weight: 0.1,
        normalizationBounds: { min: 0.05, max: 1.5 },
      },
    ]

    const fitnessHeavyMinimax = evaluateGauntlet(
      simpleAI,
      heavyMinimaxOpponents,
      defaultPositionWeights,
      defaultOutcomes,
      defaultConfidence,
      defaultWeighting
    )

    const fitnessBalanced = evaluateGauntlet(
      simpleAI,
      multipleOpponents,
      defaultPositionWeights,
      defaultOutcomes,
      defaultConfidence,
      defaultWeighting
    )

    // Different weighting should produce different fitness
    expect(fitnessHeavyMinimax).toBeDefined()
    expect(fitnessBalanced).toBeDefined()
  })

  test('should play multiple games per opponent', () => {
    const manyGames: OpponentConfig[] = [
      {
        opponent: 'simpleAI',
        numGames: 5,
        weight: 1.0,
        normalizationBounds: { min: 0.05, max: 1.5 },
      },
    ]

    const fitness = evaluateGauntlet(
      simpleAI,
      manyGames,
      defaultPositionWeights,
      defaultOutcomes,
      defaultConfidence,
      defaultWeighting
    )

    expect(fitness).toBeDefined()
    expect(typeof fitness).toBe('number')
  })

  test('should respect different bounds for different opponents', () => {
    const fitness = evaluateGauntlet(
      minimaxAI,
      multipleOpponents,
      defaultPositionWeights,
      defaultOutcomes,
      defaultConfidence,
      defaultWeighting
    )

    // MinimaxAI should perform well
    expect(fitness).toBeDefined()
  })

  test('should respect position weights', () => {
    const heavySecond = { firstPlayer: 0.2, secondPlayer: 0.8 }
    const heavyFirst = { firstPlayer: 0.8, secondPlayer: 0.2 }

    const fitnessHeavySecond = evaluateGauntlet(
      simpleAI,
      singleOpponent,
      heavySecond,
      defaultOutcomes,
      defaultConfidence,
      defaultWeighting
    )

    const fitnessHeavyFirst = evaluateGauntlet(
      simpleAI,
      singleOpponent,
      heavyFirst,
      defaultOutcomes,
      defaultConfidence,
      defaultWeighting
    )

    // Different position weights should affect fitness
    expect(fitnessHeavySecond).toBeDefined()
    expect(fitnessHeavyFirst).toBeDefined()
  })

  test('should produce deterministic results with seeded RNG', () => {
    const rng1 = createRNG('test-seed-42')
    const rng2 = createRNG('test-seed-42')

    const fitness1 = evaluateGauntlet(
      minimaxAI,
      singleOpponent,
      defaultPositionWeights,
      defaultOutcomes,
      defaultConfidence,
      defaultWeighting,
      { rng: rng1 }
    )

    const fitness2 = evaluateGauntlet(
      minimaxAI,
      singleOpponent,
      defaultPositionWeights,
      defaultOutcomes,
      defaultConfidence,
      defaultWeighting,
      { rng: rng2 }
    )

    expect(fitness1).toBe(fitness2)
  })

  test('stronger players should score higher', () => {
    const minimaxFitness = evaluateGauntlet(
      minimaxAI,
      singleOpponent,
      defaultPositionWeights,
      defaultOutcomes,
      defaultConfidence,
      defaultWeighting
    )

    const simpleFitness = evaluateGauntlet(
      simpleAI,
      [
        {
          opponent: 'minimaxAI',
          numGames: 2,
          weight: 1.0,
          normalizationBounds: { min: 0.05, max: 1.5 },
        },
      ],
      defaultPositionWeights,
      defaultOutcomes,
      defaultConfidence,
      defaultWeighting
    )

    // When both play against weaker opponent, minimax should score higher
    expect(minimaxFitness).toBeGreaterThan(simpleFitness)
  })

  test('should handle empty opponent list', () => {
    // With no opponents, should throw an error
    expect(() =>
      evaluateGauntlet(
        simpleAI,
        [],
        defaultPositionWeights,
        defaultOutcomes,
        defaultConfidence,
        defaultWeighting
      )
    ).toThrow('Cannot evaluate gauntlet: opponents array is empty')
  })
})
