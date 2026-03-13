import { argv, exitCode } from 'node:process'
import { pathToFileURL } from 'node:url'

import type { GateEasing } from '@heygrady/hexagonoids-environment'

import {
  SUPPORTED_ALGORITHMS,
  type SupportedAlgorithm,
} from './algorithmRegistry.js'
import { runCli as runReplayCli } from './cli.js'
import { runLab } from './features/lab/runLab.js'
import type { LabOptions } from './features/lab/types.js'
import { defaultProfile, getProfile } from './features/profiles/index.js'
import { loadProfile } from './features/profiles/loadProfile.js'
import { runGenerateScenariosCommand } from './features/scenarios/runGenerateScenarios.js'
import { type TrainOptions, train } from './train.js'

const isSupportedAlgorithm = (value: string): value is SupportedAlgorithm => {
  return SUPPORTED_ALGORITHMS.includes(value as SupportedAlgorithm)
}

const GATE_EASINGS: GateEasing[] = ['linear', 'quad', 'cubic', 'exp', 'circle']
const isGateEasing = (value: string): value is GateEasing => {
  return GATE_EASINGS.includes(value as GateEasing)
}

const usage = () => {
  return [
    'Usage:',
    '  hexagonoids-demo baseline [options]',
    '  hexagonoids-demo train [options]',
    '  hexagonoids-demo replay [replay-options]',
    '  hexagonoids-demo lab [--method <name> | <method>] [lab-options]',
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
    '',
    'Replay options:',
    '  replay --path <best-genome.json> [--method <name>] [--seed <seed>]',
    '',
    'Fitness weight options:',
    '  --weightRocks <float>                    Rock destruction weight (default: 0.6)',
    '  --weightAccuracy <float>                 Shooting accuracy weight (default: 0.4)',
    '',
    'Gate config options:',
    '  --actionGateFloor <float>                Min action gate output (default: 0.5)',
    '  --actionLow <float>                      Action saturation low threshold (default: 0.1)',
    '  --actionHigh <float>                     Action saturation high threshold (default: 0.5)',
    `  --actionEasing <name>                    Action penalty easing (${GATE_EASINGS.join('|')}, default: exp)`,
    '  --turnGateFloor <float>                  Min turn gate output (default: 0.1)',
    '  --turnLow <float>                        Turn saturation low threshold (default: 0.1)',
    '  --turnHigh <float>                       Turn saturation high threshold (default: 0.65)',
    `  --turnEasing <name>                      Turn penalty easing (${GATE_EASINGS.join('|')}, default: exp)`,
    '  --throttleGateFloor <float>              Min throttle gate output (default: 0.01)',
    '  --throttleLow <float>                    Throttle saturation low threshold (default: 0.1)',
    '  --throttleHigh <float>                   Throttle saturation high threshold (default: 0.9)',
    `  --throttleEasing <name>                  Throttle penalty easing (${GATE_EASINGS.join('|')}, default: exp)`,
    '  --survivalGateFloor <float>              Min survival gate output (default: 0)',
    '',
    'RL options:',
    '  --rl <none|ac|ql>                        Enable RL plugin (default: none)',
    '  --rlLearningRate <float>                 RL learning rate (default: 0.01)',
    '  --rlRewardThreshold <float>              Reward threshold for rollout capture (default: 0.1)',
    '  --rlActorActivation <sigmoid|softmax|tanh> Actor activation (AC only, default: softmax)',
    '  --rlEpsilon <float>                      Initial epsilon for Q-learning (default: 0.3)',
    '  --rlEpsilonDecay <float>                 Q-learning epsilon decay (default: 0.95)',
    '  --rlEpsilonMin <float>                   Minimum epsilon for Q-learning (default: 0.01)',
    '  --rlLamarckian                           Enable Lamarckian write-back (default)',
    '  --rlDarwinian                            Disable write-back (Darwinian mode)',
    '',
    'Lab options (also accepts common + training options):',
    `  <method>                                 ${SUPPORTED_ALGORITHMS.join(' | ')}`,
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

/**
 * Parse a single shared CLI option token. Returns the number of extra args
 * consumed (0 for flags, 1 for key-value pairs), or null if the token is
 * not a recognized shared option.
 */
const parseSharedOption = (
  token: string,
  next: string | undefined,
  options: Partial<TrainOptions>
): number | null => {
  if (token === '--method') {
    if (next == null || !isSupportedAlgorithm(next)) {
      throw new Error(`Invalid or missing --method value.\n\n${usage()}`)
    }
    options.method = next
    return 1
  }

  if (token === '--baseSeed') {
    if (next == null || next.startsWith('-')) {
      throw new Error(`Missing value for --baseSeed.\n\n${usage()}`)
    }
    options.baseSeed = next
    return 1
  }

  if (token === '--evaluationSeedsPerOrganism') {
    options.evaluationSeedsPerOrganism = readInt(token, next)
    return 1
  }

  if (token === '--maxTicks') {
    options.maxTicks = readInt(token, next)
    return 1
  }

  if (token === '--dtMs') {
    options.dtMs = readInt(token, next)
    return 1
  }

  if (token === '--thrustMath') {
    if (next !== 'fast' && next !== 'quaternion') {
      throw new Error(
        `Invalid value for --thrustMath. Expected "fast" or "quaternion".\n\n${usage()}`
      )
    }
    options.useFastThrust = next === 'fast'
    return 1
  }

  if (token === '--populationSize') {
    options.populationSize = readInt(token, next)
    return 1
  }

  if (token === '--iterations') {
    options.iterations = readInt(token, next)
    return 1
  }

  if (token === '--secondsLimit') {
    options.secondsLimit = readInt(token, next)
    return 1
  }

  if (token === '--earlyStopPatience') {
    options.earlyStopPatience = readInt(token, next)
    return 1
  }

  if (token === '--outputDir') {
    if (next == null || next.startsWith('-')) {
      throw new Error(`Missing value for --outputDir.\n\n${usage()}`)
    }
    options.outputDir = next
    return 1
  }

  if (token === '--logInterval') {
    options.logInterval = readInt(token, next)
    return 1
  }

  if (token === '--threadCount') {
    options.threadCount = readInt(token, next)
    return 1
  }

  if (token === '--profile') {
    if (next == null || next.startsWith('-')) {
      throw new Error(`Missing value for --profile.\n\n${usage()}`)
    }
    options.profilePath = next
    return 1
  }

  if (token === '--scenarios') {
    options.scenarioMode = true
    return 0
  }

  if (token === '--scenariosPerOrganism') {
    options.scenariosPerOrganism = readInt(token, next)
    return 1
  }

  if (token === '--scenarioMaxTicks') {
    options.scenarioMaxTicks = readInt(token, next)
    return 1
  }

  if (token === '--scenarioWeight') {
    options.scenarioWeight = readFloat(token, next)
    return 1
  }

  if (token === '--scenarioSeedsPerOrganism') {
    options.scenarioSeedsPerOrganism = readInt(token, next)
    return 1
  }

  if (token === '--fullGameSeedsPerOrganism') {
    options.fullGameSeedsPerOrganism = readInt(token, next)
    return 1
  }

  if (token === '--weightRocks') {
    options.fitnessWeights = {
      ...{ rocksDestroyed: 0.6, accuracy: 0.4, targetAccuracy: 0.2 },
      ...options.fitnessWeights,
      rocksDestroyed: readFloat(token, next),
    }
    return 1
  }

  if (token === '--weightAccuracy') {
    options.fitnessWeights = {
      ...{ rocksDestroyed: 0.6, accuracy: 0.4, targetAccuracy: 0.2 },
      ...options.fitnessWeights,
      accuracy: readFloat(token, next),
    }
    return 1
  }

  if (token === '--actionGateFloor') {
    options.gateConfig = {
      ...options.gateConfig,
      actionGateFloor: readFloat(token, next),
    }
    return 1
  }

  if (token === '--actionLow') {
    options.gateConfig = {
      ...options.gateConfig,
      actionLow: readFloat(token, next),
    }
    return 1
  }

  if (token === '--actionHigh') {
    options.gateConfig = {
      ...options.gateConfig,
      actionHigh: readFloat(token, next),
    }
    return 1
  }

  if (token === '--actionEasing') {
    if (next == null || !isGateEasing(next)) {
      throw new Error(
        `Invalid value for --actionEasing. Expected one of: ${GATE_EASINGS.join(', ')}.\n\n${usage()}`
      )
    }
    options.gateConfig = {
      ...options.gateConfig,
      actionEasing: next,
    }
    return 1
  }

  if (token === '--turnGateFloor') {
    options.gateConfig = {
      ...options.gateConfig,
      turnGateFloor: readFloat(token, next),
    }
    return 1
  }

  if (token === '--turnLow') {
    options.gateConfig = {
      ...options.gateConfig,
      turnLow: readFloat(token, next),
    }
    return 1
  }

  if (token === '--turnHigh') {
    options.gateConfig = {
      ...options.gateConfig,
      turnHigh: readFloat(token, next),
    }
    return 1
  }

  if (token === '--turnEasing') {
    if (next == null || !isGateEasing(next)) {
      throw new Error(
        `Invalid value for --turnEasing. Expected one of: ${GATE_EASINGS.join(', ')}.\n\n${usage()}`
      )
    }
    options.gateConfig = {
      ...options.gateConfig,
      turnEasing: next,
    }
    return 1
  }

  if (token === '--throttleGateFloor') {
    options.gateConfig = {
      ...options.gateConfig,
      throttleGateFloor: readFloat(token, next),
    }
    return 1
  }

  if (token === '--throttleLow') {
    options.gateConfig = {
      ...options.gateConfig,
      throttleLow: readFloat(token, next),
    }
    return 1
  }

  if (token === '--throttleHigh') {
    options.gateConfig = {
      ...options.gateConfig,
      throttleHigh: readFloat(token, next),
    }
    return 1
  }

  if (token === '--throttleEasing') {
    if (next == null || !isGateEasing(next)) {
      throw new Error(
        `Invalid value for --throttleEasing. Expected one of: ${GATE_EASINGS.join(', ')}.\n\n${usage()}`
      )
    }
    options.gateConfig = {
      ...options.gateConfig,
      throttleEasing: next,
    }
    return 1
  }

  if (token === '--survivalGateFloor') {
    options.gateConfig = {
      ...options.gateConfig,
      survivalGateFloor: readFloat(token, next),
    }
    return 1
  }

  if (token === '--rl') {
    if (next == null) {
      throw new Error(`Missing value for --rl.\n\n${usage()}`)
    }
    if (next === 'ac') {
      options.rlMode = 'actor-critic'
    } else if (next === 'ql') {
      options.rlMode = 'q-learning'
    } else if (next === 'none') {
      options.rlMode = 'none'
    } else {
      throw new Error(`Invalid value for --rl.\n\n${usage()}`)
    }
    return 1
  }

  if (token === '--rlLearningRate') {
    options.rlLearningRate = readFloat(token, next)
    return 1
  }

  if (token === '--rlRewardThreshold') {
    options.rlRewardThreshold = readFloat(token, next)
    return 1
  }

  if (token === '--rlActorActivation') {
    if (
      next == null ||
      !['sigmoid', 'softmax', 'tanh'].includes(next as string)
    ) {
      throw new Error(
        'Invalid value for --rlActorActivation. Expected sigmoid|softmax|tanh.'
      )
    }
    options.rlActorActivation = next as 'sigmoid' | 'softmax' | 'tanh'
    return 1
  }

  if (token === '--rlEpsilon') {
    options.rlEpsilon = readFloat(token, next)
    return 1
  }

  if (token === '--rlEpsilonDecay') {
    options.rlEpsilonDecay = readFloat(token, next)
    return 1
  }

  if (token === '--rlEpsilonMin') {
    options.rlEpsilonMin = readFloat(token, next)
    return 1
  }

  if (token === '--rlLamarckian') {
    options.rlIsLamarckian = true
    return 0
  }

  if (token === '--rlDarwinian') {
    options.rlIsLamarckian = false
    return 0
  }

  return null
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

    const skip = parseSharedOption(token, next, options)
    if (skip != null) {
      index += skip
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

    // Lab-specific options
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

    // Positional algorithm name
    if (isSupportedAlgorithm(token) && options.method == null) {
      options.method = token
      continue
    }

    // Shared options
    const skip = parseSharedOption(token, next, options)
    if (skip != null) {
      index += skip
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
  const cliOptions = parseTrainLikeOptions(args, 'baseline')
  const options: TrainOptions = {
    ...(defaultProfile.config ?? {}),
    ...cliOptions,
    baselineOnly: true,
  }
  const result = await train(options)
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

  // Load profile: explicit --profile flag, or built-in default
  let profileConfig: Partial<TrainOptions> = {}
  if (cliOptions.profilePath != null) {
    const namedProfile = getProfile(cliOptions.profilePath)
    if (namedProfile != null) {
      profileConfig = namedProfile.config ?? {}
      console.log(`Using profile: ${cliOptions.profilePath}`)
    } else {
      const profile = await loadProfile(cliOptions.profilePath)
      profileConfig = profile.config ?? {}
      console.log(`Loading profile from ${cliOptions.profilePath}...`)
    }
  } else {
    profileConfig = defaultProfile.config ?? {}
    console.log('Using default profile')
  }

  // CLI options override profile defaults, default profile as base
  const options: TrainOptions = {
    ...(defaultProfile.config ?? {}),
    ...profileConfig,
    ...cliOptions,
    baselineOnly: false,
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
