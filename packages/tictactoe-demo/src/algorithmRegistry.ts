import {
  ALL_CPPN_ACTIVATIONS,
  getBuiltInEvolutionAlgorithmDefinition,
  type BuiltInEvolutionAlgorithmDefinition,
  type BuiltInEvolutionAlgorithmName,
} from '@neat-evolution/evolution-manager'

export type SupportedAlgorithm = BuiltInEvolutionAlgorithmName
export type AlgorithmDefinition = BuiltInEvolutionAlgorithmDefinition

export const allActivations = ALL_CPPN_ACTIVATIONS

export const getAlgorithmDefinition = (
  algorithm: SupportedAlgorithm
): AlgorithmDefinition => {
  return getBuiltInEvolutionAlgorithmDefinition(algorithm)
}
