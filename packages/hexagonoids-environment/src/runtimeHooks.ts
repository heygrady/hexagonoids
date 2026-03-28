import type { HexagonoidsEnvironmentConfig } from './HexagonoidsEnvironmentConfig.js'
import type {
  GauntletBreakdown,
  RewardBreakdown,
  RewardComponent,
} from './evaluation/calculateFitness.js'
import type {
  RewardConfig,
  RewardMode,
  SimulationSnapshot,
  TickDeltas,
} from './evaluation/simulateGame.js'
import type {
  RuntimeHookAnnotations,
  RuntimeScoringHooksConfig,
} from './runtimeHooksTypes.js'

export type { RuntimeHookAnnotations, RuntimeScoringHooksConfig }

export interface RewardHookContext {
  hookId: string
  rewardMode: RewardMode
  deltas: TickDeltas
  snapshot: SimulationSnapshot
  rewardConfig: RewardConfig
  rewardTerms: Readonly<RewardBreakdown>
}

export interface RewardHookResult {
  adjustments?: Partial<Record<RewardComponent, number>> | undefined
  annotations?: RuntimeHookAnnotations | undefined
}

export type RuntimeRewardHook = (
  context: RewardHookContext
) => RewardHookResult | null | void

export interface FitnessHookContext {
  hookId: string
  breakdown: Readonly<GauntletBreakdown>
  config: Pick<
    HexagonoidsEnvironmentConfig,
    | 'fitnessWeights'
    | 'gateConfig'
    | 'scenarioWeight'
    | 'fullGameWeight'
    | 'curriculumWeight'
  > & {
    behavioralGateConfig?: HexagonoidsEnvironmentConfig['behavioralGateConfig']
    rewardConfig?: HexagonoidsEnvironmentConfig['rewardConfig']
  }
}

export interface FitnessHookResult {
  fitness?: number | undefined
  blendedFitnessRaw?: number | undefined
  annotations?: RuntimeHookAnnotations | undefined
}

export type RuntimeFitnessHook = (
  context: FitnessHookContext
) => FitnessHookResult | null | void

export interface RuntimeScoringHookModule {
  id: string
  reward?: RuntimeRewardHook | undefined
  fitness?: RuntimeFitnessHook | undefined
}

export interface ResolvedRuntimeScoringHooks {
  rewardRef?: string | undefined
  fitnessRef?: string | undefined
  reward?: RuntimeRewardHook | undefined
  fitness?: RuntimeFitnessHook | undefined
}

const runtimeHookRegistry = new Map<string, RuntimeScoringHookModule>()

export function registerRuntimeScoringHookModule(
  hookModule: RuntimeScoringHookModule
): void {
  runtimeHookRegistry.set(hookModule.id, hookModule)
}

export function getRuntimeScoringHookModule(
  id: string
): RuntimeScoringHookModule | undefined {
  return runtimeHookRegistry.get(id)
}

export function resolveRuntimeScoringHooks(
  refs?: RuntimeScoringHooksConfig
): ResolvedRuntimeScoringHooks {
  if (refs == null) {
    return {}
  }

  const resolved: ResolvedRuntimeScoringHooks = {
    ...(refs.reward != null ? { rewardRef: refs.reward } : {}),
    ...(refs.fitness != null ? { fitnessRef: refs.fitness } : {}),
  }

  if (refs.reward != null) {
    const rewardHook = getRuntimeScoringHookModule(refs.reward)
    if (rewardHook?.reward == null) {
      throw new Error(`Unknown runtime reward hook "${refs.reward}".`)
    }
    resolved.reward = rewardHook.reward
  }

  if (refs.fitness != null) {
    const fitnessHook = getRuntimeScoringHookModule(refs.fitness)
    if (fitnessHook?.fitness == null) {
      throw new Error(`Unknown runtime fitness hook "${refs.fitness}".`)
    }
    resolved.fitness = fitnessHook.fitness
  }

  return resolved
}

registerRuntimeScoringHookModule({
  id: 'hexagonoids/default-reward',
  reward: ({ hookId }) => ({
    annotations: { hook: hookId, rig: 'default' },
  }),
})

registerRuntimeScoringHookModule({
  id: 'hexagonoids/default-fitness',
  fitness: ({ hookId }) => ({
    annotations: { hook: hookId, rig: 'default' },
  }),
})

registerRuntimeScoringHookModule({
  id: 'hexagonoids/turn-discipline-reward',
  reward: ({ hookId, snapshot }) => {
    const executedTurn = snapshot.inputs.left || snapshot.inputs.right
    const rawConflict = snapshot.rawInputs.left && snapshot.rawInputs.right
    const ambiguousTurn = snapshot.turnAmbiguous

    let actionBandAdjustment = 0
    if (rawConflict) {
      actionBandAdjustment -= 0.003
    } else if (ambiguousTurn) {
      actionBandAdjustment -= 0.0015
    } else if (executedTurn) {
      actionBandAdjustment += 0.00025
    }

    return {
      ...(actionBandAdjustment !== 0
        ? { adjustments: { actionBand: actionBandAdjustment } }
        : {}),
      annotations: { hook: hookId, rig: 'turn-discipline' },
    }
  },
})
