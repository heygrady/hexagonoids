import {
  REWARD_COMPONENTS,
  type RewardBreakdown,
  type RewardComponent,
} from '../evaluation/calculateFitness.js'
import type { RuntimeHookAnnotations } from '../runtimeHooksTypes.js'

export function applyRewardHookAdjustments(
  target: RewardBreakdown,
  adjustments?: Partial<Record<RewardComponent, number>>
): number {
  if (adjustments == null) return 0

  let delta = 0
  for (const component of REWARD_COMPONENTS) {
    const value = adjustments[component]
    if (typeof value !== 'number' || !Number.isFinite(value) || value === 0) {
      continue
    }
    target[component] += value
    target.total += value
    delta += value
  }
  return delta
}

export function mergeRuntimeHookAnnotations(
  ...sources: Array<RuntimeHookAnnotations | undefined>
): RuntimeHookAnnotations | undefined {
  const merged: RuntimeHookAnnotations = {}

  for (const source of sources) {
    if (source == null) continue
    Object.assign(merged, source)
  }

  return Object.keys(merged).length > 0 ? merged : undefined
}
