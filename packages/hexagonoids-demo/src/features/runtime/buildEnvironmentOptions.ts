import {
  DEFAULT_HEXAGONOIDS_ENVIRONMENT_CONFIG,
  type HexagonoidsEnvironmentConfig,
  type ScenarioSnapshot,
  type SimulationConfig,
} from '@heygrady/hexagonoids-environment'

import type { TrainOptions } from '../training/train.js'

/**
 * Convert `TrainOptions` fields into a partial `HexagonoidsEnvironmentConfig`.
 *
 * This is the shared conversion used by training-oriented workflows and the
 * browser observe adapter. Callers pass the result to `mergeConfig()` or
 * `createEnvironment()` to get a fully-resolved config.
 */
export function buildEnvironmentOptions(
  options: Partial<TrainOptions>,
  scenarioBank?: ScenarioSnapshot[],
  outputCount?: number
): Partial<HexagonoidsEnvironmentConfig> {
  const simulation: Partial<SimulationConfig> = {
    useFastThrust: options.useFastThrust ?? true,
    ...(options.curriculumCount != null && {
      curriculumCount: options.curriculumCount,
    }),
    ...(options.maxTicks != null && { maxTicks: options.maxTicks }),
    ...(options.dtMs != null && { dtMs: options.dtMs }),
    ...(options.scenariosPerOrganism != null && {
      scenariosPerOrganism: options.scenariosPerOrganism,
    }),
    ...(options.scenarioMaxTicks != null && {
      scenarioMaxTicks: options.scenarioMaxTicks,
    }),
  }

  return {
    simulation: simulation as SimulationConfig,
    ...(scenarioBank != null && { scenarioBank }),
    ...(options.fitnessWeights != null && {
      fitnessWeights: options.fitnessWeights,
    }),
    ...(options.gateConfig != null && {
      gateConfig: {
        ...DEFAULT_HEXAGONOIDS_ENVIRONMENT_CONFIG.gateConfig,
        ...options.gateConfig,
      },
    }),
    ...(options.scenarioWeight != null && {
      scenarioWeight: options.scenarioWeight,
    }),
    ...(options.fullGameWeight != null && {
      fullGameWeight: options.fullGameWeight,
    }),
    ...(options.curriculumWeight != null && {
      curriculumWeight: options.curriculumWeight,
    }),
    ...(options.scenarioSeedsPerOrganism != null && {
      scenarioSeedsPerOrganism: options.scenarioSeedsPerOrganism,
    }),
    ...(options.fullGameSeedsPerOrganism != null && {
      fullGameSeedsPerOrganism: options.fullGameSeedsPerOrganism,
    }),
    ...(options.behavioralGateConfig != null && {
      behavioralGateConfig:
        options.behavioralGateConfig as HexagonoidsEnvironmentConfig['behavioralGateConfig'],
    }),
    ...(outputCount != null && { outputCount }),
    ...buildRewardConfig(options),
  } as Partial<HexagonoidsEnvironmentConfig>
}

function buildRewardConfig(
  options: Partial<TrainOptions>
): { rewardConfig: Record<string, number> } | Record<string, never> {
  const overrides: Record<string, number> = {}
  if (options.rlRewardRock != null) overrides.rockReward = options.rlRewardRock
  if (options.rlRewardDeath != null)
    overrides.deathPenalty = options.rlRewardDeath
  if (options.rlRewardSurvival != null)
    overrides.survivalReward = options.rlRewardSurvival
  if (options.rlRewardScoreScale != null)
    overrides.scoreScale = options.rlRewardScoreScale
  if (options.rlRewardShotPenalty != null)
    overrides.shotPenalty = options.rlRewardShotPenalty
  if (options.rlRewardWaveBonus != null)
    overrides.waveBonus = options.rlRewardWaveBonus
  if (options.rlRewardBulletAim != null)
    overrides.bulletAimReward = options.rlRewardBulletAim
  if (options.rlRewardBulletAimOutOfRange != null)
    overrides.bulletAimOutOfRangeScale = options.rlRewardBulletAimOutOfRange
  if (options.rlRewardBulletMissDemerit != null)
    overrides.bulletMissDemerit = options.rlRewardBulletMissDemerit
  if (options.rlRewardThrust != null)
    overrides.thrustReward = options.rlRewardThrust
  if (Object.keys(overrides).length === 0) return {}
  return { rewardConfig: overrides }
}
