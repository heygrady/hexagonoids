import {
  DEFAULT_HEXAGONOIDS_ENVIRONMENT_CONFIG,
  type HexagonoidsEnvironmentConfig,
  type ScenarioSnapshot,
  type SimulationConfig,
} from '@heygrady/hexagonoids-environment'

import type { TrainOptions } from './train.js'

/**
 * Convert `TrainOptions` fields into a partial `HexagonoidsEnvironmentConfig`.
 *
 * This is the shared conversion used by both the Node CLI (`train()`) and the
 * browser observe adapter. Callers pass the result to `mergeConfig()` or
 * `createEnvironment()` to get a fully-resolved config.
 */
export function buildEnvironmentOptions(
  options: Partial<TrainOptions>,
  scenarioBank?: ScenarioSnapshot[]
): Partial<HexagonoidsEnvironmentConfig> {
  const simulation: Partial<SimulationConfig> = {
    useFastThrust: options.useFastThrust ?? true,
    curriculumEnabled:
      options.curriculumEnabled ??
      DEFAULT_HEXAGONOIDS_ENVIRONMENT_CONFIG.simulation.curriculumEnabled,
    curriculumCount:
      options.curriculumCount ??
      DEFAULT_HEXAGONOIDS_ENVIRONMENT_CONFIG.simulation.curriculumCount,
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
  }
}
