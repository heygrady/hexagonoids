import {
  DEFAULT_HEXAGONOIDS_ENVIRONMENT_CONFIG,
  evaluateFullGameFitness,
  neatAgent,
  simulateGame,
} from '@heygrady/hexagonoids-environment'
import { loadGenome } from '../persistence/loadGenome.js'
import type { SupportedAlgorithm } from '../registries/algorithmRegistry.js'
import {
  HexagonoidsEvolutionManager,
  type HexagonoidsEvolutionManagerOptions,
} from './EvolutionManager.js'

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
  options: ReplayOptions,
  managerOptions: HexagonoidsEvolutionManagerOptions = {}
): Promise<ReplayResult> {
  const manager = new HexagonoidsEvolutionManager({
    ...managerOptions,
    method: options.method,
    maxTicks: options.maxTicks,
    dtMs: options.dtMs,
  })

  const serialized = loadGenome(options.pathname)
  const organism = manager.createOrganism(options.method, serialized)
  const executor = manager.organismToExecutor(organism)
  const simulation = {
    maxTicks: options.maxTicks,
    dtMs: options.dtMs,
    useFastThrust: options.useFastThrust,
  }
  const metrics = simulateGame(neatAgent, simulation, options.seed, executor)
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
