import { existsSync } from 'node:fs'
import { argv, exitCode } from 'node:process'
import { pathToFileURL } from 'node:url'

import {
  SUPPORTED_ALGORITHMS,
  type SupportedAlgorithm,
} from './algorithmRegistry.js'
import { runCli as runReplayCli } from './cli.js'
import { loadProfile } from './features/lab/loadProfile.js'
import { profileToTrainOptions } from './features/lab/profileToTrainOptions.js'
import { resolveProfilePath } from './features/lab/resolveProfilePath.js'
import { runLab } from './features/lab/runLab.js'
import type { LabOptions } from './features/lab/types.js'
import { runGenerateScenariosCommand } from './features/scenarios/runGenerateScenarios.js'
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
    '  hexagonoids-demo lab [lab-options]',
    '  hexagonoids-demo scenarios [scenario-options]',
    '',
    'Commands:',
    '  baseline  Run baseline-only scoring (doNothing/random)',
    '  train     Run evolution training',
    '  replay    Replay a saved genome (delegates to replay CLI)',
    '  lab       Run a short training session + behavioral analysis',
    '  scenarios Refresh the scenario bank from many trained agents',
    '',
    'Common options for baseline/train:',
    `  --method <name>                         ${SUPPORTED_ALGORITHMS.join(' | ')}`,
    '  --baseSeed <seed>',
    '  --evaluationSeedsPerOrganism <int>',
    '  --maxTicks <int>',
    '  --dtMs <int>',
    '  --thrustMath <fast|quaternion>          Math mode for thrust + movement',
    '',
    'Scenario options:',
    '  --scenarios                              Enable scenario-based evaluation',
    '  --scenariosPerOrganism <int>             Scenarios per organism (default: 20)',
    '  --scenarioMaxTicks <int>                 Max ticks per scenario (default: 120)',
    '  --scenarioWeight <float>                 Blend weight for scenarios vs full-game (0-1, default: 1.0)',
    '  --scenarioSeedsPerOrganism <int>         Sub-seeds per scenario evaluation (default: 1)',
    '  --fullGameSeedsPerOrganism <int>         Sub-seeds per full-game evaluation (default: 1)',
    '',
    'Training-only options:',
    '  --profile <nameOrPath>                  Profile nickname or file path (.json/.mjs)',
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
    '',
    'Fitness weight options:',
    '  --weightRocks <float>                    Rock destruction weight (default: 0.5)',
    '  --weightAccuracy <float>                 Shooting accuracy weight (default: 0.3)',
    '  --weightSurvival <float>                 Survival weight (default: 0.2)',
    '',
    'Gate config options:',
    '  --gateFloor <float>                      Min action gate output (default: 0.5)',
    '  --actionLow <float>                      Action saturation low threshold (default: 0.1)',
    '  --actionHigh <float>                     Action saturation high threshold (default: 0.5)',
    '  --actionSteepness <float>                Saturation penalty steepness (default: 8)',
    '  --turnGateFloor <float>                  Min turn gate output (default: 0.1)',
    '  --turnLow <float>                        Turn saturation low threshold (default: 0.1)',
    '  --turnHigh <float>                       Turn saturation high threshold (default: 0.65)',
    '  --turnSteepness <float>                  Turn saturation steepness (default: 7)',
    '',
    'Lab options (also accepts common + training options):',
    '  --profile <path>                         Profile file (.json or .mjs)',
    '  --name <string>                          Experiment name',
    '  --analysisSeedsPerGenome <int>            Seeds per genome during analysis (default: 8)',
    '  --analysisMaxTicks <int>                  Max ticks per analysis game (default: 3000)',
    '',
    'Scenario bank options:',
    '  --max-labs <int>',
    '  --hero-count <int>',
    '  --count-per-source <int>',
    '  --panel-max <int>',
    '  --panel-scout-count <int>',
    '  --rewind <int>',
    '  --max-games <int>',
    '  --eval-ticks <int>',
    '  --instant-death-trials <int>',
    '  --random-baseline-trials <int>',
    '  --final-count <int>',
    '  --seed <seed>',
    '  --output <path>',
    '  --existing <path>',
    '  --no-merge-existing',
    '  --report <path>',
  ].join('\n')
}

const readInt = (token: string, value: string | undefined, min = 1): number => {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || !Number.isInteger(parsed) || parsed < min) {
    throw new Error(`Invalid value for ${token}.`)
  }
  return parsed
}

const readFloat = (
  token: string,
  value: string | undefined,
  min = 0,
  max = 1
): number => {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed < min || parsed > max) {
    throw new Error(
      `Invalid value for ${token}. Must be between ${min} and ${max}.`
    )
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

    if (token === '--profile') {
      if (next == null || next.startsWith('-')) {
        throw new Error(`Missing value for --profile.\n\n${usage()}`)
      }
      options.profilePath = next
      index += 1
      continue
    }

    if (token === '--scenarios') {
      options.scenarioMode = true
      continue
    }

    if (token === '--scenariosPerOrganism') {
      options.scenariosPerOrganism = readInt(token, next)
      index += 1
      continue
    }

    if (token === '--scenarioMaxTicks') {
      options.scenarioMaxTicks = readInt(token, next)
      index += 1
      continue
    }

    if (token === '--scenarioWeight') {
      options.scenarioWeight = readFloat(token, next)
      index += 1
      continue
    }

    if (token === '--scenarioSeedsPerOrganism') {
      options.scenarioSeedsPerOrganism = readInt(token, next)
      index += 1
      continue
    }

    if (token === '--fullGameSeedsPerOrganism') {
      options.fullGameSeedsPerOrganism = readInt(token, next)
      index += 1
      continue
    }

    if (token === '--weightRocks') {
      options.fitnessWeights = {
        ...{ rocksDestroyed: 0.5, accuracy: 0.3, survival: 0.2 },
        ...options.fitnessWeights,
        rocksDestroyed: readFloat(token, next),
      }
      index += 1
      continue
    }

    if (token === '--weightAccuracy') {
      options.fitnessWeights = {
        ...{ rocksDestroyed: 0.5, accuracy: 0.3, survival: 0.2 },
        ...options.fitnessWeights,
        accuracy: readFloat(token, next),
      }
      index += 1
      continue
    }

    if (token === '--weightSurvival') {
      options.fitnessWeights = {
        ...{ rocksDestroyed: 0.5, accuracy: 0.3, survival: 0.2 },
        ...options.fitnessWeights,
        survival: readFloat(token, next),
      }
      index += 1
      continue
    }

    if (token === '--gateFloor') {
      options.gateConfig = {
        ...options.gateConfig,
        floor: readFloat(token, next),
      }
      index += 1
      continue
    }

    if (token === '--actionLow') {
      options.gateConfig = {
        ...options.gateConfig,
        actionLow: readFloat(token, next),
      }
      index += 1
      continue
    }

    if (token === '--actionHigh') {
      options.gateConfig = {
        ...options.gateConfig,
        actionHigh: readFloat(token, next),
      }
      index += 1
      continue
    }

    if (token === '--actionSteepness') {
      options.gateConfig = {
        ...options.gateConfig,
        actionSteepness: readFloat(token, next, 0, 100),
      }
      index += 1
      continue
    }

    if (token === '--turnGateFloor') {
      options.gateConfig = {
        ...options.gateConfig,
        turnFloor: readFloat(token, next),
      }
      index += 1
      continue
    }

    if (token === '--turnLow') {
      options.gateConfig = {
        ...options.gateConfig,
        turnLow: readFloat(token, next),
      }
      index += 1
      continue
    }

    if (token === '--turnHigh') {
      options.gateConfig = {
        ...options.gateConfig,
        turnHigh: readFloat(token, next),
      }
      index += 1
      continue
    }

    if (token === '--turnSteepness') {
      options.gateConfig = {
        ...options.gateConfig,
        turnSteepness: readFloat(token, next, 0, 100),
      }
      index += 1
      continue
    }

    throw new Error(`Unknown option "${token}" for ${mode}.\n\n${usage()}`)
  }

  return options
}

const parseLabOptions = (args: string[]): LabOptions => {
  const options: LabOptions = {}

  for (let index = 0; index < args.length; index += 1) {
    const token = args[index]
    if (token == null) continue
    const next = args[index + 1]

    if (token === '--help' || token === '-h') {
      throw new Error(usage())
    }

    if (token === '--profile') {
      if (next == null || next.startsWith('-')) {
        throw new Error(`Missing value for --profile.\n\n${usage()}`)
      }
      options.profilePath = next
      index += 1
      continue
    }

    if (token === '--name') {
      if (next == null || next.startsWith('-')) {
        throw new Error(`Missing value for --name.\n\n${usage()}`)
      }
      options.name = next
      index += 1
      continue
    }

    if (token === '--analysisSeedsPerGenome') {
      options.analysisSeedsPerGenome = readInt(token, next)
      index += 1
      continue
    }

    if (token === '--analysisMaxTicks') {
      options.analysisMaxTicks = readInt(token, next)
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

    if (token === '--scenarios') {
      options.scenarioMode = true
      continue
    }

    if (token === '--scenariosPerOrganism') {
      options.scenariosPerOrganism = readInt(token, next)
      index += 1
      continue
    }

    if (token === '--scenarioMaxTicks') {
      options.scenarioMaxTicks = readInt(token, next)
      index += 1
      continue
    }

    if (token === '--scenarioWeight') {
      options.scenarioWeight = readFloat(token, next)
      index += 1
      continue
    }

    if (token === '--scenarioSeedsPerOrganism') {
      options.scenarioSeedsPerOrganism = readInt(token, next)
      index += 1
      continue
    }

    if (token === '--fullGameSeedsPerOrganism') {
      options.fullGameSeedsPerOrganism = readInt(token, next)
      index += 1
      continue
    }

    if (token === '--weightRocks') {
      options.weightRocks = readFloat(token, next)
      index += 1
      continue
    }

    if (token === '--weightAccuracy') {
      options.weightAccuracy = readFloat(token, next)
      index += 1
      continue
    }

    if (token === '--weightSurvival') {
      options.weightSurvival = readFloat(token, next)
      index += 1
      continue
    }

    if (token === '--gateFloor') {
      options.gateFloor = readFloat(token, next)
      index += 1
      continue
    }

    if (token === '--actionLow') {
      options.actionLow = readFloat(token, next)
      index += 1
      continue
    }

    if (token === '--actionHigh') {
      options.actionHigh = readFloat(token, next)
      index += 1
      continue
    }

    if (token === '--actionSteepness') {
      options.actionSteepness = readFloat(token, next, 0, 100)
      index += 1
      continue
    }

    if (token === '--turnGateFloor') {
      options.turnGateFloor = readFloat(token, next)
      index += 1
      continue
    }

    if (token === '--turnLow') {
      options.turnLow = readFloat(token, next)
      index += 1
      continue
    }

    if (token === '--turnHigh') {
      options.turnHigh = readFloat(token, next)
      index += 1
      continue
    }

    if (token === '--turnSteepness') {
      options.turnSteepness = readFloat(token, next, 0, 100)
      index += 1
      continue
    }

    throw new Error(`Unknown option "${token}" for lab.\n\n${usage()}`)
  }

  return options
}

const runLabCommand = async (args: string[]): Promise<number> => {
  const options = parseLabOptions(args)
  await runLab(options)
  return 0
}

const runScenariosCommand = async (args: string[]): Promise<number> => {
  return await runGenerateScenariosCommand(args)
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
  const cliOptions = parseTrainLikeOptions(args, 'train')

  let options: TrainOptions = { ...cliOptions, baselineOnly: false }

  // Determine profile path: explicit --profile flag, or auto-detect default.json
  let profilePath = cliOptions.profilePath
  if (profilePath == null) {
    const defaultPath = resolveProfilePath('default')
    if (existsSync(defaultPath)) {
      profilePath = 'default'
      console.log(`Auto-loading default profile from ${defaultPath}...`)
    }
  }

  if (profilePath != null) {
    const resolvedPath = resolveProfilePath(profilePath)
    if (cliOptions.profilePath != null) {
      console.log(`Loading profile from ${resolvedPath}...`)
    }
    const profile = await loadProfile(resolvedPath)
    const profileDefaults = profileToTrainOptions(profile)
    // CLI options override profile defaults
    options = { ...profileDefaults, ...cliOptions, baselineOnly: false }
  }

  const result = await train(options)
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
  console.log(`Generations Log: ${result.generationsLogPath}`)
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
    if (command === 'lab') {
      return await runLabCommand(rest)
    }
    if (command === 'scenarios') {
      return await runScenariosCommand(rest)
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
