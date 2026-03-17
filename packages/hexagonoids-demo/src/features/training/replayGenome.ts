import {
  createGameAgent,
  DEFAULT_HEXAGONOIDS_ENVIRONMENT_CONFIG,
  evaluateFullGameFitness,
  simulateGame,
} from '@heygrady/hexagonoids-environment'
import { createVanillaStepAgent } from '@neat-evolution/rl-core'
import type { SupportedAlgorithm } from '../registries/algorithmRegistry.js'
import { hydrateToExecutor } from '../registries/hydrateGenome.js'

export interface ReplayOptions {
  pathname: string
  method: SupportedAlgorithm
  seed: string
  maxTicks: number
  dtMs: number
  useFastThrust: boolean
}

export const DEFAULT_REPLAY_METHOD: SupportedAlgorithm = 'NEAT'
export const DEFAULT_REPLAY_SEED = 'hexagonoids-replay'

export const DEFAULT_REPLAY_OPTIONS: Omit<ReplayOptions, 'pathname'> = {
  method: DEFAULT_REPLAY_METHOD,
  seed: DEFAULT_REPLAY_SEED,
  maxTicks: DEFAULT_HEXAGONOIDS_ENVIRONMENT_CONFIG.simulation.maxTicks,
  dtMs: DEFAULT_HEXAGONOIDS_ENVIRONMENT_CONFIG.simulation.dtMs,
  useFastThrust:
    DEFAULT_HEXAGONOIDS_ENVIRONMENT_CONFIG.simulation.useFastThrust,
}

export interface ReplayResult {
  method: SupportedAlgorithm
  pathname: string
  seed: string
  fitness: number
  score: number
  rocksDestroyed: number
  accuracy: number
  timeAlive: number
}

export async function replayGenome(
  options: ReplayOptions
): Promise<ReplayResult> {
  const executor = hydrateToExecutor(options.pathname, options.method)
  const simulation = {
    maxTicks: options.maxTicks,
    dtMs: options.dtMs,
    useFastThrust: options.useFastThrust,
  }
  const controller = createVanillaStepAgent(executor)
  const gameAgent = createGameAgent(controller)
  const metrics = simulateGame(gameAgent.agent, simulation, options.seed)
  const fitness = evaluateFullGameFitness(metrics)

  return {
    method: options.method,
    pathname: options.pathname,
    seed: options.seed,
    fitness,
    score: metrics.score,
    rocksDestroyed: metrics.rocksDestroyed,
    accuracy: metrics.accuracy,
    timeAlive: metrics.timeAlive,
  }
}
