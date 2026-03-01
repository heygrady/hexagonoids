import type { SupportedAlgorithm } from '../../algorithmRegistry.js'
import type { TrainOptions } from '../../train.js'
import type { LabProfile } from './types.js'

/**
 * Convert a loaded profile's config into a partial `TrainOptions` object.
 *
 * Flat profile keys are mapped to structured TrainOptions fields. Callers
 * should spread the result as defaults, allowing explicit CLI options to
 * take priority.
 */
export function profileToTrainOptions(
  profile: LabProfile
): Partial<TrainOptions> {
  const c = profile.config
  if (c == null) return {}

  const options: Partial<TrainOptions> = {}

  if (c.method != null) options.method = c.method as SupportedAlgorithm
  if (c.iterations != null) options.iterations = c.iterations as number
  if (c.populationSize != null)
    options.populationSize = c.populationSize as number
  if (c.evaluationSeedsPerOrganism != null)
    options.evaluationSeedsPerOrganism = c.evaluationSeedsPerOrganism as number
  if (c.maxTicks != null) options.maxTicks = c.maxTicks as number
  if (c.dtMs != null) options.dtMs = c.dtMs as number
  if (c.baseSeed != null) options.baseSeed = c.baseSeed as string
  if (c.scenariosPerOrganism != null)
    options.scenariosPerOrganism = c.scenariosPerOrganism as number
  if (c.scenarioMaxTicks != null)
    options.scenarioMaxTicks = c.scenarioMaxTicks as number
  if (c.scenarioWeight != null)
    options.scenarioWeight = c.scenarioWeight as number
  if (c.scenarioSeedsPerOrganism != null)
    options.scenarioSeedsPerOrganism = c.scenarioSeedsPerOrganism as number
  if (c.fullGameSeedsPerOrganism != null)
    options.fullGameSeedsPerOrganism = c.fullGameSeedsPerOrganism as number

  // Map flat weight keys to structured fitnessWeights
  const weightRocks = c.weightRocks as number | undefined
  const weightAccuracy = c.weightAccuracy as number | undefined
  const weightSurvival = c.weightSurvival as number | undefined
  if (weightRocks != null || weightAccuracy != null || weightSurvival != null) {
    options.fitnessWeights = {
      rocksDestroyed: weightRocks ?? 0.5,
      accuracy: weightAccuracy ?? 0.3,
      survival: weightSurvival ?? 0.2,
    }
  }

  // Map flat gate keys to structured gateConfig
  const gateFloor = c.gateFloor as number | undefined
  const actionLow = c.actionLow as number | undefined
  const actionHigh = c.actionHigh as number | undefined
  const actionSteepness = c.actionSteepness as number | undefined
  const turnGateFloor = c.turnGateFloor as number | undefined
  const turnLow = c.turnLow as number | undefined
  const turnHigh = c.turnHigh as number | undefined
  const turnSteepness = c.turnSteepness as number | undefined
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
    options.gateConfig = {
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

  return options
}
