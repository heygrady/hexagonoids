import { argv, exitCode } from 'node:process'
import { pathToFileURL } from 'node:url'

import {
  DEFAULT_HEXAGONOIDS_ENVIRONMENT_CONFIG,
  neatAgent,
  simulateGame,
  weightedFitnessSum,
} from '@heygrady/hexagonoids-environment'

import {
  SUPPORTED_ALGORITHMS,
  type SupportedAlgorithm,
} from './algorithmRegistry.js'
import {
  HexagonoidsEvolutionManager,
  type HexagonoidsEvolutionManagerOptions,
} from './EvolutionManager.js'
import { loadGenome } from './persistence/loadGenome.js'

interface ReplayCliOptions {
  pathname: string
  method: SupportedAlgorithm
  seed: string
  maxTicks: number
  dtMs: number
  useFastThrust: boolean
}

const DEFAULT_METHOD: SupportedAlgorithm = 'NEAT'
const DEFAULT_SEED = 'hexagonoids-replay'

const isSupportedAlgorithm = (value: string): value is SupportedAlgorithm => {
  return SUPPORTED_ALGORITHMS.includes(value as SupportedAlgorithm)
}

const usage = () => {
  return [
    'Usage:',
    '  hexagonoids-demo replay --path <best-genome.json> [--method <name>] [--seed <seed>]',
    '  hexagonoids-demo replay <best-genome.json> [method]',
    '  hexagonoids-replay --path <best-genome.json> [--method <name>] [--seed <seed>]',
    '',
    `Methods: ${SUPPORTED_ALGORITHMS.join(', ')}`,
    'Options:',
    '  --maxTicks <int>',
    '  --dtMs <int>',
    '  --thrustMath <fast|quaternion>  Math mode for thrust + movement',
  ].join('\n')
}

const parseReplayOptions = (args: string[]): ReplayCliOptions => {
  const options: {
    method: SupportedAlgorithm
    seed: string
    maxTicks: number
    dtMs: number
    useFastThrust: boolean
  } = {
    method: DEFAULT_METHOD,
    seed: DEFAULT_SEED,
    maxTicks: DEFAULT_HEXAGONOIDS_ENVIRONMENT_CONFIG.simulation.maxTicks,
    dtMs: DEFAULT_HEXAGONOIDS_ENVIRONMENT_CONFIG.simulation.dtMs,
    useFastThrust:
      DEFAULT_HEXAGONOIDS_ENVIRONMENT_CONFIG.simulation.useFastThrust,
  }
  let pathname: string | undefined

  for (let index = 0; index < args.length; index += 1) {
    const token = args[index]
    if (token == null) {
      continue
    }
    const next = args[index + 1]

    if (token === '--help' || token === '-h') {
      throw new Error(usage())
    }

    if (token === '--path') {
      if (next == null || next.startsWith('-')) {
        throw new Error(`Missing value for --path.\n\n${usage()}`)
      }
      pathname = next
      index += 1
      continue
    }

    if (token === '--method') {
      if (next == null || !isSupportedAlgorithm(next)) {
        throw new Error(`Invalid or missing --method value.\n\n${usage()}`)
      }
      options.method = next
      index += 1
      continue
    }

    if (token === '--seed') {
      if (next == null || next.startsWith('-')) {
        throw new Error(`Missing value for --seed.\n\n${usage()}`)
      }
      options.seed = next
      index += 1
      continue
    }

    if (token === '--maxTicks') {
      const parsed = Number(next)
      if (!Number.isFinite(parsed) || parsed <= 0) {
        throw new Error(`Invalid value for --maxTicks.\n\n${usage()}`)
      }
      options.maxTicks = parsed
      index += 1
      continue
    }

    if (token === '--dtMs') {
      const parsed = Number(next)
      if (!Number.isFinite(parsed) || parsed <= 0) {
        throw new Error(`Invalid value for --dtMs.\n\n${usage()}`)
      }
      options.dtMs = parsed
      index += 1
      continue
    }

    if (token === '--thrustMath') {
      if (next !== 'fast' && next !== 'quaternion') {
        throw new Error(
          `Invalid value for --thrustMath. Expected "fast" or "quaternion".\n\n${usage()}`
        )
      }
      options.useFastThrust = next === 'fast'
      index += 1
      continue
    }

    if (token.startsWith('-')) {
      throw new Error(`Unknown option "${token}".\n\n${usage()}`)
    }

    if (pathname == null) {
      pathname = token
      continue
    }

    if (isSupportedAlgorithm(token)) {
      options.method = token
      continue
    }

    throw new Error(`Unexpected argument "${token}".\n\n${usage()}`)
  }

  if (pathname == null) {
    throw new Error(`Missing genome path.\n\n${usage()}`)
  }

  return {
    pathname,
    method: options.method,
    seed: options.seed,
    maxTicks: options.maxTicks,
    dtMs: options.dtMs,
    useFastThrust: options.useFastThrust,
  }
}

export async function replayGenome(
  options: ReplayCliOptions,
  managerOptions: HexagonoidsEvolutionManagerOptions = {}
): Promise<void> {
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
  const fitness = weightedFitnessSum(
    metrics,
    DEFAULT_HEXAGONOIDS_ENVIRONMENT_CONFIG.fitnessWeights,
    simulation,
    DEFAULT_HEXAGONOIDS_ENVIRONMENT_CONFIG.gateConfig
  )

  console.log(`Replay completed for ${options.method}`)
  console.log(`Genome: ${options.pathname}`)
  console.log(`Seed: ${options.seed}`)
  console.log(`Fitness: ${fitness.toFixed(3)}`)
  console.log(`Score: ${metrics.score.toFixed(3)}`)
  console.log(`Rocks Destroyed: ${metrics.rocksDestroyed.toFixed(3)}`)
  console.log(`Accuracy: ${metrics.accuracy.toFixed(3)}`)
  console.log(`Time Alive: ${metrics.timeAlive.toFixed(3)}`)
}

export async function runCli(args = argv.slice(2)): Promise<number> {
  let options: ReplayCliOptions

  try {
    options = parseReplayOptions(args)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (message === usage()) {
      console.log(message)
      return 0
    }
    console.error(message)
    return 1
  }

  try {
    await replayGenome(options)
    return 0
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error(`Replay failed: ${message}`)
    return 1
  }
}

const isMain = (() => {
  const entry = argv[1]
  if (entry == null) {
    return false
  }

  return import.meta.url === pathToFileURL(entry).href
})()

if (isMain) {
  runCli().then((code) => {
    if (code !== 0 && exitCode == null) {
      process.exitCode = code
    }
  })
}
