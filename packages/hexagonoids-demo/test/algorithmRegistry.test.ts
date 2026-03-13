import { createPopulation as createCPPNPopulation } from '@neat-evolution/cppn'
import {
  createPopulation as createDESHyperNEATPopulation,
  defaultTopologyConfigOptions,
} from '@neat-evolution/des-hyperneat'
import type { Environment } from '@neat-evolution/environment'
import { createPopulation as createESHyperNEATPopulation } from '@neat-evolution/es-hyperneat'
import type { Evaluator } from '@neat-evolution/evaluator'
import { defaultPopulationOptions } from '@neat-evolution/evolution'
import type { Executor, SyncExecutor } from '@neat-evolution/executor'
import { createPopulation as createHyperNEATPopulation } from '@neat-evolution/hyperneat'
import { createPopulation as createNEATPopulation } from '@neat-evolution/neat'
import type { RNG } from '@neat-evolution/utils'
import { describe, expect, it } from 'vitest'
import {
  type AlgorithmIO,
  createHexagonoidsCPPNGenomeOptions,
  createHexagonoidsDESHyperNEATGenomeOptions,
  createHexagonoidsESHyperNEATGenomeOptions,
  createHexagonoidsHyperNEATGenomeOptions,
  createHexagonoidsNEATConfigOptions,
  createHexagonoidsNEATGenomeOptions,
  getAlgorithmDefinitions,
  HEXAGONOIDS_IO,
  SUPPORTED_ALGORITHMS,
  type SupportedAlgorithm,
} from '../src/algorithmRegistry.js'

// --- Test-only stubs for creating populations without real workers ---

const createEvaluatorStub = (
  io: AlgorithmIO
): Evaluator<Record<string, never>> => {
  const environment = {
    description: io,
    isAsync: false,
    evaluate: (_executor: SyncExecutor, _rng?: RNG) => 0,
    evaluateBatch: (_executors: SyncExecutor[], _rng?: RNG) => [],
    evaluateAsync: async (_executor: Executor, _rng?: RNG) => 0,
    evaluateBatchAsync: async (_executors: Executor[], _rng?: RNG) => [],
    toFactoryOptions: () => ({}),
  } satisfies Environment<Record<string, never>>

  return {
    environment,
    initGenomeFactory: async () => {},
    evaluate: async function* (_genomeEntries) {},
  } satisfies Evaluator<Record<string, never>>
}

const createReproducerStub = () => ({
  copyElites: async (_speciesIds: number[]) => [],
  reproduce: async (_speciesIds: number[]) => [],
})

const createPopulationOptions = (size: number) => ({
  ...defaultPopulationOptions,
  populationSize: size,
})

function createTestPopulation(
  method: SupportedAlgorithm,
  size: number,
  io: AlgorithmIO
) {
  const evaluator = createEvaluatorStub(io)
  const popOptions = createPopulationOptions(size)
  const neatConfig = createHexagonoidsNEATConfigOptions()

  switch (method) {
    case 'NEAT':
      return createNEATPopulation(
        () => createReproducerStub(),
        evaluator,
        neatConfig,
        popOptions,
        createHexagonoidsNEATGenomeOptions()
      )
    case 'CPPN':
      return createCPPNPopulation(
        () => createReproducerStub(),
        evaluator,
        neatConfig,
        popOptions,
        createHexagonoidsCPPNGenomeOptions()
      )
    case 'HyperNEAT':
      return createHyperNEATPopulation(
        () => createReproducerStub(),
        evaluator,
        neatConfig,
        popOptions,
        createHexagonoidsHyperNEATGenomeOptions()
      )
    case 'ES-HyperNEAT':
      return createESHyperNEATPopulation(
        () => createReproducerStub(),
        evaluator,
        neatConfig,
        popOptions,
        createHexagonoidsESHyperNEATGenomeOptions()
      )
    case 'DES-HyperNEAT':
      return createDESHyperNEATPopulation(
        () => createReproducerStub(),
        evaluator,
        structuredClone(defaultTopologyConfigOptions),
        neatConfig,
        popOptions,
        createHexagonoidsDESHyperNEATGenomeOptions()
      )
  }
}

describe('algorithmRegistry', () => {
  it('exposes all five supported methods', () => {
    expect(SUPPORTED_ALGORITHMS).toEqual([
      'NEAT',
      'CPPN',
      'HyperNEAT',
      'ES-HyperNEAT',
      'DES-HyperNEAT',
    ])
    expect(getAlgorithmDefinitions()).toHaveLength(5)
  })

  it('can create populations for fixed hexagonoids I/O', () => {
    for (const method of SUPPORTED_ALGORITHMS) {
      const population = createTestPopulation(method, 6, HEXAGONOIDS_IO)
      expect(population).toBeTruthy()
    }
  })

  it('uses cone8 x rock2 encoding with 90 inputs and 4 outputs', () => {
    expect(HEXAGONOIDS_IO.inputs).toBe(90)
    expect(HEXAGONOIDS_IO.outputs).toBe(4)
  })

  it('all definitions expose stable method metadata', () => {
    const methods = new Set(SUPPORTED_ALGORITHMS)

    for (const definition of getAlgorithmDefinitions()) {
      expect(methods.has(definition.method as SupportedAlgorithm)).toBe(true)
      expect(typeof definition.createAlgorithm).toBe('function')
      expect(typeof definition.usesCPPNActivations).toBe('boolean')
    }
  })
})
