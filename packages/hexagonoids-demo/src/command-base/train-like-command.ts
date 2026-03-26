import type {
  FitnessWeights,
  GateConfig,
  GateEasing,
} from '@heygrady/hexagonoids-environment'
import { defaultProfile, getProfile } from '../features/profiles/index.js'
import { loadProfile } from '../features/profiles/loadProfile.js'
import type { SupportedAlgorithm } from '../features/registries/algorithmRegistry.js'
import type { TrainOptions } from '../features/training/train.js'
import { BaseCommand } from './base-command.js'

const DEFAULT_FITNESS_WEIGHTS = {
  rocksDestroyed: 0.6,
  accuracy: 0.4,
  targetAccuracy: 0.2,
  targetKillRatio: 0.5,
} satisfies FitnessWeights

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return value != null && typeof value === 'object'
}

const isNonEmptyString = (value: unknown): value is string => {
  return typeof value === 'string' && value.length > 0
}

const isNumber = (value: unknown): value is number => {
  return typeof value === 'number' && Number.isFinite(value)
}

interface TrainLikeBooleanFlags {
  scenarios?: boolean
  rlLamarckian?: boolean
  rlDarwinian?: boolean
}

interface TrainLikeStringFlags {
  method?: string
  baseSeed?: string
  outputDir?: string
  thrustMath?: string
  actionEasing?: string
  turnEasing?: string
  throttleEasing?: string
  rl?: string
}

interface TrainLikeNumberFlags {
  evaluationSeedsPerOrganism?: number
  maxTicks?: number
  dtMs?: number
  populationSize?: number
  iterations?: number
  secondsLimit?: number
  earlyStopPatience?: number
  logInterval?: number
  threadCount?: number
  scenariosPerOrganism?: number
  scenarioMaxTicks?: number
  scenarioWeight?: number
  scenarioSeedsPerOrganism?: number
  fullGameSeedsPerOrganism?: number
  weightRocks?: number
  weightAccuracy?: number
  actionGateFloor?: number
  actionLow?: number
  actionHigh?: number
  turnGateFloor?: number
  turnLow?: number
  turnHigh?: number
  throttleGateFloor?: number
  throttleLow?: number
  throttleHigh?: number
  survivalGateFloor?: number
  rlLearningRate?: number
  rlRewardThreshold?: number
  rlEpsilon?: number
  rlEpsilonDecay?: number
  rlEpsilonMin?: number
  rlEpochs?: number
  rlMinibatchSize?: number
  rlBatchTransitions?: number
  rlReplayCapacity?: number
  rlReplayBatchSize?: number
  rlTargetSyncInterval?: number
  rlWarmupGenerations?: number
  rlRewardRock?: number
  rlRewardDeath?: number
  rlRewardSurvival?: number
  rlRewardEngagement?: number
  rlRewardProgress?: number
  rlRewardScoreScale?: number
  rlRewardShotPenalty?: number
  rlRewardWaveBonus?: number
  rlRewardBulletAim?: number
  rlRewardBulletAimOutOfRange?: number
  rlRewardBulletMissDemerit?: number
  rlRewardThrust?: number
}

type TrainLikeFlags = TrainLikeBooleanFlags &
  TrainLikeStringFlags &
  TrainLikeNumberFlags

export abstract class TrainLikeCommand extends BaseCommand {
  protected async resolveProfile(profileRef: string | undefined): Promise<{
    config: Partial<TrainOptions>
    label: string
  }> {
    if (profileRef == null) {
      return {
        config: defaultProfile.config ?? {},
        label: defaultProfile.name,
      }
    }

    const namedProfile = getProfile(profileRef)
    if (namedProfile != null) {
      return {
        config: namedProfile.config ?? {},
        label: namedProfile.name,
      }
    }

    const profile = await loadProfile(profileRef)
    return {
      config: profile.config ?? {},
      label: profile.name,
    }
  }

  private applyCoreTrainOptions(
    options: Partial<TrainOptions>,
    flags: TrainLikeFlags
  ): void {
    if (isNonEmptyString(flags.method)) {
      options.method = flags.method as SupportedAlgorithm
    }
    if (isNonEmptyString(flags.baseSeed)) options.baseSeed = flags.baseSeed
    if (isNumber(flags.evaluationSeedsPerOrganism)) {
      options.evaluationSeedsPerOrganism = flags.evaluationSeedsPerOrganism
    }
    if (isNumber(flags.maxTicks)) options.maxTicks = flags.maxTicks
    if (isNumber(flags.dtMs)) options.dtMs = flags.dtMs
    if (flags.thrustMath === 'fast') options.useFastThrust = true
    if (flags.thrustMath === 'quaternion') options.useFastThrust = false
    if (isNumber(flags.populationSize))
      options.populationSize = flags.populationSize
    if (isNumber(flags.iterations)) options.iterations = flags.iterations
    if (isNumber(flags.secondsLimit)) options.secondsLimit = flags.secondsLimit
    if (isNumber(flags.earlyStopPatience)) {
      options.earlyStopPatience = flags.earlyStopPatience
    }
    if (isNonEmptyString(flags.outputDir)) options.outputDir = flags.outputDir
    if (isNumber(flags.logInterval)) options.logInterval = flags.logInterval
    if (isNumber(flags.threadCount)) options.threadCount = flags.threadCount
  }

  private applyScenarioOptions(
    options: Partial<TrainOptions>,
    flags: TrainLikeFlags
  ): void {
    if (isNumber(flags.scenariosPerOrganism)) {
      options.scenariosPerOrganism = flags.scenariosPerOrganism
    }
    if (isNumber(flags.scenarioMaxTicks)) {
      options.scenarioMaxTicks = flags.scenarioMaxTicks
    }
    if (isNumber(flags.scenarioWeight))
      options.scenarioWeight = flags.scenarioWeight
    if (isNumber(flags.scenarioSeedsPerOrganism)) {
      options.scenarioSeedsPerOrganism = flags.scenarioSeedsPerOrganism
    }
    if (isNumber(flags.fullGameSeedsPerOrganism)) {
      options.fullGameSeedsPerOrganism = flags.fullGameSeedsPerOrganism
    }
  }

  private createFitnessWeights(
    flags: TrainLikeFlags
  ): FitnessWeights | undefined {
    const fitnessWeights: Partial<FitnessWeights> = {}
    if (isNumber(flags.weightRocks)) {
      fitnessWeights.rocksDestroyed = flags.weightRocks
    }
    if (isNumber(flags.weightAccuracy)) {
      fitnessWeights.accuracy = flags.weightAccuracy
    }
    if (Object.keys(fitnessWeights).length === 0) {
      return undefined
    }

    return {
      ...DEFAULT_FITNESS_WEIGHTS,
      ...fitnessWeights,
    }
  }

  private createGateConfig(
    flags: TrainLikeFlags
  ): Partial<GateConfig> | undefined {
    const gateConfig: Partial<GateConfig> = {}
    if (isNumber(flags.actionGateFloor))
      gateConfig.actionGateFloor = flags.actionGateFloor
    if (isNumber(flags.actionLow)) gateConfig.actionLow = flags.actionLow
    if (isNumber(flags.actionHigh)) gateConfig.actionHigh = flags.actionHigh
    if (isNonEmptyString(flags.actionEasing)) {
      gateConfig.actionEasing = flags.actionEasing as GateEasing
    }
    if (isNumber(flags.turnGateFloor))
      gateConfig.turnGateFloor = flags.turnGateFloor
    if (isNumber(flags.turnLow)) gateConfig.turnLow = flags.turnLow
    if (isNumber(flags.turnHigh)) gateConfig.turnHigh = flags.turnHigh
    if (isNonEmptyString(flags.turnEasing)) {
      gateConfig.turnEasing = flags.turnEasing as GateEasing
    }
    if (isNumber(flags.throttleGateFloor)) {
      gateConfig.throttleGateFloor = flags.throttleGateFloor
    }
    if (isNumber(flags.throttleLow)) gateConfig.throttleLow = flags.throttleLow
    if (isNumber(flags.throttleHigh))
      gateConfig.throttleHigh = flags.throttleHigh
    if (isNonEmptyString(flags.throttleEasing)) {
      gateConfig.throttleEasing = flags.throttleEasing as GateEasing
    }
    if (isNumber(flags.survivalGateFloor)) {
      gateConfig.survivalGateFloor = flags.survivalGateFloor
    }

    return Object.keys(gateConfig).length > 0 ? gateConfig : undefined
  }

  private applyRlOptions(
    options: Partial<TrainOptions>,
    flags: TrainLikeFlags
  ): void {
    if (flags.rl === 'ac') options.rlMode = 'actor-critic'
    if (flags.rl === 'ql') options.rlMode = 'q-learning'
    if (flags.rl === 'a2c') options.rlMode = 'a2c'
    if (flags.rl === 'dql') options.rlMode = 'dql'
    if (flags.rl === 'ppo') options.rlMode = 'ppo'
    if (flags.rl === 'none') options.rlMode = 'none'
    if (isNumber(flags.rlLearningRate)) {
      options.rlLearningRate = flags.rlLearningRate
    }
    if (isNumber(flags.rlRewardThreshold)) {
      options.rlRewardThreshold = flags.rlRewardThreshold
    }
    if (isNumber(flags.rlEpsilon)) options.rlEpsilon = flags.rlEpsilon
    if (isNumber(flags.rlEpsilonDecay)) {
      options.rlEpsilonDecay = flags.rlEpsilonDecay
    }
    if (isNumber(flags.rlEpsilonMin)) options.rlEpsilonMin = flags.rlEpsilonMin
    if (isNumber(flags.rlEpochs)) options.rlEpochs = flags.rlEpochs
    if (isNumber(flags.rlMinibatchSize)) {
      options.rlMinibatchSize = flags.rlMinibatchSize
    }
    if (isNumber(flags.rlBatchTransitions)) {
      options.rlBatchTransitions = flags.rlBatchTransitions
    }
    if (isNumber(flags.rlReplayCapacity)) {
      options.rlReplayCapacity = flags.rlReplayCapacity
    }
    if (isNumber(flags.rlReplayBatchSize)) {
      options.rlReplayBatchSize = flags.rlReplayBatchSize
    }
    if (isNumber(flags.rlTargetSyncInterval)) {
      options.rlTargetSyncInterval = flags.rlTargetSyncInterval
    }
    if (isNumber(flags.rlRewardRock)) options.rlRewardRock = flags.rlRewardRock
    if (isNumber(flags.rlRewardDeath))
      options.rlRewardDeath = flags.rlRewardDeath
    if (isNumber(flags.rlRewardSurvival)) {
      options.rlRewardSurvival = flags.rlRewardSurvival
    }
    if (isNumber(flags.rlRewardEngagement)) {
      options.rlRewardEngagement = flags.rlRewardEngagement
    }
    if (isNumber(flags.rlRewardProgress)) {
      options.rlRewardProgress = flags.rlRewardProgress
    }
    if (isNumber(flags.rlRewardScoreScale)) {
      options.rlRewardScoreScale = flags.rlRewardScoreScale
    }
    if (isNumber(flags.rlRewardShotPenalty)) {
      options.rlRewardShotPenalty = flags.rlRewardShotPenalty
    }
    if (isNumber(flags.rlRewardWaveBonus)) {
      options.rlRewardWaveBonus = flags.rlRewardWaveBonus
    }
    if (isNumber(flags.rlRewardBulletAim)) {
      options.rlRewardBulletAim = flags.rlRewardBulletAim
    }
    if (isNumber(flags.rlRewardBulletAimOutOfRange)) {
      options.rlRewardBulletAimOutOfRange = flags.rlRewardBulletAimOutOfRange
    }
    if (isNumber(flags.rlRewardBulletMissDemerit)) {
      options.rlRewardBulletMissDemerit = flags.rlRewardBulletMissDemerit
    }
    if (isNumber(flags.rlRewardThrust)) {
      options.rlRewardThrust = flags.rlRewardThrust
    }

    if (isNumber(flags.rlWarmupGenerations)) {
      options.rlWarmupGenerations = flags.rlWarmupGenerations
    }

    if (flags.rlLamarckian === true && flags.rlDarwinian === true) {
      this.error('Use only one of --rlLamarckian or --rlDarwinian.')
    }
    if (flags.rlLamarckian === true) options.rlIsLamarckian = true
    if (flags.rlDarwinian === true) options.rlIsLamarckian = false
  }

  protected flagsToTrainOptions(
    flags: Record<string, unknown>
  ): Partial<TrainOptions> {
    const typedFlags = flags as TrainLikeFlags
    const options: Partial<TrainOptions> = {}

    this.applyCoreTrainOptions(options, typedFlags)
    this.applyScenarioOptions(options, typedFlags)

    const fitnessWeights = this.createFitnessWeights(typedFlags)
    if (fitnessWeights != null) {
      options.fitnessWeights = fitnessWeights
    }

    const gateConfig = this.createGateConfig(typedFlags)
    if (gateConfig != null) {
      options.gateConfig = gateConfig
    }

    this.applyRlOptions(options, typedFlags)

    return options
  }

  protected mergeTrainOptions(
    ...sources: Array<Partial<TrainOptions> | undefined>
  ): TrainOptions {
    const merged: TrainOptions = {}
    let mergedFitnessWeights: Partial<FitnessWeights> | undefined
    let mergedGateConfig: Partial<GateConfig> | undefined

    for (const source of sources) {
      if (source == null) continue
      Object.assign(merged, source)

      if (isRecord(source.fitnessWeights)) {
        mergedFitnessWeights = {
          ...(mergedFitnessWeights ?? {}),
          ...source.fitnessWeights,
        }
      }

      if (isRecord(source.gateConfig)) {
        mergedGateConfig = {
          ...(mergedGateConfig ?? {}),
          ...source.gateConfig,
        }
      }
    }

    if (mergedFitnessWeights != null) {
      merged.fitnessWeights = mergedFitnessWeights as FitnessWeights
    }

    if (mergedGateConfig != null) {
      merged.gateConfig = mergedGateConfig as Partial<GateConfig>
    }

    return merged
  }
}
