import { argv, exitCode } from 'node:process'
import { pathToFileURL } from 'node:url'

import {
  SUPPORTED_ALGORITHMS,
  type SupportedAlgorithm,
} from './algorithmRegistry.js'
import { runCli as runReplayCli } from './cli.js'
import { type TrainOptions, train } from './train.js'

const isSupportedAlgorithm = (value: string): value is SupportedAlgorithm => {
  return SUPPORTED_ALGORITHMS.includes(value as SupportedAlgorithm)
}

const usage = () => {
  return [
    'Usage:',
    '  hexagonoids-demo baseline [options]',
    '  hexagonoids-demo train [options]',
    '  hexagonoids-demo replay [replay-options]',
    '',
    'Commands:',
    '  baseline  Run baseline-only scoring (doNothing/random)',
    '  train     Run evolution training',
    '  replay    Replay a saved genome (delegates to replay CLI)',
    '',
    'Common options for baseline/train:',
    `  --method <name>                         ${SUPPORTED_ALGORITHMS.join(' | ')}`,
    '  --baseSeed <seed>',
    '  --evaluationSeedsPerOrganism <int>',
    '  --maxTicks <int>',
    '  --dtMs <int>',
    '  --thrustMath <fast|quaternion>          Math mode for thrust + movement',
    '',
    'Training-only options:',
    '  --populationSize <int>',
    '  --iterations <int>',
    '  --secondsLimit <int>',
    '  --earlyStopPatience <int>',
    '  --outputDir <path>',
    '  --logInterval <int>',
    '  --threadCount <int>',
    '  --perfProfile',
    '  --perfProfileSampleEveryNGames <int>',
    '  --perfProfileOutput <path>',
    '',
    'Replay options:',
    '  replay --path <best-genome.json> [--method <name>] [--seed <seed>]',
  ].join('\n')
}

const readInt = (token: string, value: string | undefined, min = 1): number => {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || !Number.isInteger(parsed) || parsed < min) {
    throw new Error(`Invalid value for ${token}.`)
  }
  return parsed
}

const parseTrainLikeOptions = (
  args: string[],
  mode: 'baseline' | 'train'
): TrainOptions => {
  const options: TrainOptions = {}

  for (let index = 0; index < args.length; index += 1) {
    const token = args[index]
    if (token == null) continue
    const next = args[index + 1]

    if (token === '--help' || token === '-h') {
      throw new Error(usage())
    }

    if (token === '--method') {
      if (next == null || !isSupportedAlgorithm(next)) {
        throw new Error(`Invalid or missing --method value.\n\n${usage()}`)
      }
      options.method = next
      index += 1
      continue
    }

    if (token === '--baseSeed') {
      if (next == null || next.startsWith('-')) {
        throw new Error(`Missing value for --baseSeed.\n\n${usage()}`)
      }
      options.baseSeed = next
      index += 1
      continue
    }

    if (token === '--evaluationSeedsPerOrganism') {
      options.evaluationSeedsPerOrganism = readInt(token, next)
      index += 1
      continue
    }

    if (token === '--maxTicks') {
      options.maxTicks = readInt(token, next)
      index += 1
      continue
    }

    if (token === '--dtMs') {
      options.dtMs = readInt(token, next)
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

    if (token === '--populationSize') {
      options.populationSize = readInt(token, next)
      index += 1
      continue
    }

    if (token === '--iterations') {
      options.iterations = readInt(token, next)
      index += 1
      continue
    }

    if (token === '--secondsLimit') {
      options.secondsLimit = readInt(token, next)
      index += 1
      continue
    }

    if (token === '--earlyStopPatience') {
      options.earlyStopPatience = readInt(token, next)
      index += 1
      continue
    }

    if (token === '--outputDir') {
      if (next == null || next.startsWith('-')) {
        throw new Error(`Missing value for --outputDir.\n\n${usage()}`)
      }
      options.outputDir = next
      index += 1
      continue
    }

    if (token === '--logInterval') {
      options.logInterval = readInt(token, next)
      index += 1
      continue
    }

    if (token === '--threadCount') {
      options.threadCount = readInt(token, next)
      index += 1
      continue
    }

    if (token === '--perfProfile') {
      options.perfProfile = true
      continue
    }

    if (token === '--perfProfileSampleEveryNGames') {
      options.perfProfileSampleEveryNGames = readInt(token, next)
      index += 1
      continue
    }

    if (token === '--perfProfileOutput') {
      if (next == null || next.startsWith('-')) {
        throw new Error(`Missing value for --perfProfileOutput.\n\n${usage()}`)
      }
      options.perfProfileOutputPath = next
      index += 1
      continue
    }

    throw new Error(`Unknown option "${token}" for ${mode}.\n\n${usage()}`)
  }

  return options
}

const formatNumber = (value: number): string => value.toFixed(4)

const runBaseline = async (args: string[]): Promise<number> => {
  const options = parseTrainLikeOptions(args, 'baseline')
  const result = await train({
    ...options,
    baselineOnly: true,
  })
  if (result.mode !== 'baseline') {
    throw new Error('Expected baseline mode result.')
  }

  console.log(`Mode: baseline`)
  console.log(`Method: ${result.method}`)
  console.log(`Seeds: ${result.seeds.length}`)
  for (const score of result.scores) {
    console.log(
      `${score.name}: meanFitness=${formatNumber(score.meanFitness)} score=${formatNumber(score.metrics.score)} accuracy=${formatNumber(score.metrics.accuracy)} rocks=${formatNumber(score.metrics.rocksDestroyed)}`
    )
  }
  return 0
}

const runTraining = async (args: string[]): Promise<number> => {
  const options = parseTrainLikeOptions(args, 'train')
  const result = await train({
    ...options,
    baselineOnly: false,
  })
  if (result.mode !== 'training') {
    throw new Error('Expected training mode result.')
  }

  console.log(`Mode: training`)
  console.log(`Method: ${result.method}`)
  console.log(`Best Fitness: ${formatNumber(result.bestFitness)}`)
  if (result.populationFitnessMean != null) {
    console.log(
      `Population Mean: ${formatNumber(result.populationFitnessMean)}`
    )
  }
  if (result.populationFitnessMedian != null) {
    console.log(
      `Population Median: ${formatNumber(result.populationFitnessMedian)}`
    )
  }
  console.log(`Best File: ${result.bestFilePath}`)
  console.log(`Heroes Log: ${result.heroesLogPath}`)
  return 0
}

export async function runMainCli(args = argv.slice(2)): Promise<number> {
  const [command, ...rest] = args

  if (command == null || command === '--help' || command === '-h') {
    console.log(usage())
    return 0
  }

  try {
    if (command === 'baseline') {
      return await runBaseline(rest)
    }
    if (command === 'train') {
      return await runTraining(rest)
    }
    if (command === 'replay') {
      return await runReplayCli(rest)
    }
    throw new Error(`Unknown command "${command}".\n\n${usage()}`)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error(message)
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
  runMainCli().then((code) => {
    if (code !== 0 && exitCode == null) {
      process.exitCode = code
    }
  })
}
