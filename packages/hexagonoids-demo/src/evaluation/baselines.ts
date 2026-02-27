import {
  type AgentFn,
  DEFAULT_HEXAGONOIDS_ENVIRONMENT_CONFIG,
  type RawMetrics,
  type SimulationConfig,
  simulateGame,
  weightedFitnessSum,
} from '@heygrady/hexagonoids-environment'

import { aggregateRawMetrics, mean } from './metrics.js'

export type BaselineScore = {
  name: string
  meanFitness: number
  metrics: RawMetrics
}

export const summarizeBaselineAgent = (
  name: string,
  agent: AgentFn,
  seeds: string[],
  simulation: Pick<SimulationConfig, 'maxTicks' | 'dtMs' | 'useFastThrust'>
): BaselineScore => {
  const metrics = seeds.map((seed) => simulateGame(agent, simulation, seed))
  const fitnessBySeed = metrics.map((raw) =>
    weightedFitnessSum(
      raw,
      DEFAULT_HEXAGONOIDS_ENVIRONMENT_CONFIG.fitnessWeights,
      simulation
    )
  )

  return {
    name,
    meanFitness: mean(fitnessBySeed),
    metrics: aggregateRawMetrics(metrics),
  }
}
