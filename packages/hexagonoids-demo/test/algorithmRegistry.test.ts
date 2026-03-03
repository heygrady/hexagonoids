import { describe, expect, it } from 'vitest'
import {
  createHexagonoidsIO,
  getAlgorithmDefinition,
  getAlgorithmDefinitions,
  HEXAGONOIDS_IO,
  SUPPORTED_ALGORITHMS,
  type SupportedAlgorithm,
} from '../src/algorithmRegistry.js'

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
      const definition = getAlgorithmDefinition(method)
      const population = definition.createPopulation(6, HEXAGONOIDS_IO)
      expect(population).toBeTruthy()
    }
  })

  it('can derive alternate I/O sizes from encoding presets', () => {
    expect(HEXAGONOIDS_IO.inputs).toBe(69)
    expect(createHexagonoidsIO('six').inputs).toBe(101)
    expect(createHexagonoidsIO('cone8').inputs).toBe(37)
  })

  it('all definitions expose stable method metadata', () => {
    const methods = new Set(SUPPORTED_ALGORITHMS)

    for (const definition of getAlgorithmDefinitions()) {
      expect(methods.has(definition.method as SupportedAlgorithm)).toBe(true)
      expect(typeof definition.createAlgorithm).toBe('function')
      expect(typeof definition.createPopulation).toBe('function')
      expect(typeof definition.usesCPPNActivations).toBe('boolean')
    }
  })
})
