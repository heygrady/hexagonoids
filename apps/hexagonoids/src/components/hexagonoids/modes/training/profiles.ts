import {
  SUPPORTED_ALGORITHMS,
  type SupportedAlgorithm,
} from '@heygrady/hexagonoids-demo'
import {
  type EncodingPreset,
  isEncodingPreset,
} from '@heygrady/hexagonoids-environment'
import type { ObserveTrainingConfig } from './createObserveTrainingAdapter'

type ProfileJson = Record<string, unknown>

const profileModules = import.meta.glob<ProfileJson>(
  '../../../../../../packages/hexagonoids-demo/.artifacts/profiles/*.json',
  { eager: true, import: 'default' }
)

const profileMap = new Map<string, ProfileJson>()
for (const [key, value] of Object.entries(profileModules)) {
  const match = key.match(/\/([^/]+)\.json$/)
  if (match?.[1] != null) {
    profileMap.set(match[1], value)
  }
}

/**
 * Look up a JSON profile by nickname and map it to `ObserveTrainingConfig`
 * overrides. Returns `undefined` when the profile is not found.
 */
export function getObserveProfile(
  name: string
): Partial<ObserveTrainingConfig> | undefined {
  const raw = profileMap.get(name)
  if (raw == null) return undefined

  const config: Partial<ObserveTrainingConfig> = {}

  if (typeof raw.evaluationSeedsPerOrganism === 'number')
    config.evaluationSeedsPerOrganism = raw.evaluationSeedsPerOrganism
  if (typeof raw.maxTicks === 'number') config.maxTicks = raw.maxTicks
  if (typeof raw.populationSize === 'number')
    config.populationSize = raw.populationSize
  if (typeof raw.scenariosPerOrganism === 'number')
    config.scenariosPerOrganism = raw.scenariosPerOrganism
  if (typeof raw.scenarioMaxTicks === 'number')
    config.scenarioMaxTicks = raw.scenarioMaxTicks
  if (typeof raw.scenarioWeight === 'number')
    config.scenarioWeight = raw.scenarioWeight
  if (typeof raw.scenarioSeedsPerOrganism === 'number')
    config.scenarioSeedsPerOrganism = raw.scenarioSeedsPerOrganism
  if (typeof raw.fullGameSeedsPerOrganism === 'number')
    config.fullGameSeedsPerOrganism = raw.fullGameSeedsPerOrganism
  if (
    typeof raw.encodingPreset === 'string' &&
    isEncodingPreset(raw.encodingPreset)
  ) {
    config.encodingPreset = raw.encodingPreset as EncodingPreset
  }
  if (
    typeof raw.method === 'string' &&
    SUPPORTED_ALGORITHMS.includes(raw.method as SupportedAlgorithm)
  ) {
    config.method = raw.method as SupportedAlgorithm
  }
  if (typeof raw.iterations === 'number') config.maxGenerations = raw.iterations

  // Map flat weight keys to structured fitnessWeights
  const weightRocks =
    typeof raw.weightRocks === 'number' ? raw.weightRocks : undefined
  const weightAccuracy =
    typeof raw.weightAccuracy === 'number' ? raw.weightAccuracy : undefined
  const weightSurvival =
    typeof raw.weightSurvival === 'number' ? raw.weightSurvival : undefined
  if (weightRocks != null || weightAccuracy != null || weightSurvival != null) {
    config.fitnessWeights = {
      rocksDestroyed: weightRocks ?? 0.5,
      accuracy: weightAccuracy ?? 0.3,
      survival: weightSurvival ?? 0.2,
    }
  }

  // Map flat gate keys to structured gateConfig
  const gateFloor =
    typeof raw.gateFloor === 'number'
      ? raw.gateFloor
      : typeof raw.actionGateFloor === 'number'
        ? raw.actionGateFloor
        : undefined
  const actionLow =
    typeof raw.actionLow === 'number' ? raw.actionLow : undefined
  const actionHigh =
    typeof raw.actionHigh === 'number' ? raw.actionHigh : undefined
  const actionSteepness =
    typeof raw.actionSteepness === 'number' ? raw.actionSteepness : undefined
  const turnGateFloor =
    typeof raw.turnGateFloor === 'number' ? raw.turnGateFloor : undefined
  const turnLow = typeof raw.turnLow === 'number' ? raw.turnLow : undefined
  const turnHigh = typeof raw.turnHigh === 'number' ? raw.turnHigh : undefined
  const turnSteepness =
    typeof raw.turnSteepness === 'number' ? raw.turnSteepness : undefined
  const hasActionGate =
    gateFloor != null ||
    actionLow != null ||
    actionHigh != null ||
    actionSteepness != null
  const hasTurnGate =
    turnGateFloor != null ||
    turnLow != null ||
    turnHigh != null ||
    turnSteepness != null
  if (hasActionGate || hasTurnGate) {
    config.gateConfig = {
      ...(gateFloor != null && { floor: gateFloor }),
      ...(actionLow != null && { actionLow }),
      ...(actionHigh != null && { actionHigh }),
      ...(actionSteepness != null && { actionSteepness }),
      ...(turnGateFloor != null && { turnFloor: turnGateFloor }),
      ...(turnLow != null && { turnLow }),
      ...(turnHigh != null && { turnHigh }),
      ...(turnSteepness != null && { turnSteepness }),
    }
  }

  return config
}
