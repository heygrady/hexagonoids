import type {
  ResolvedTrainingProfile,
  TrainingProfile,
  TrainingProfileConfig,
  TrainingProfileHooks,
  TrainingProfileMetadata,
} from './types.js'

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return value != null && typeof value === 'object'
}

type BehavioralBandKey = 'thrust' | 'fire' | 'turn' | 'turnBias'

const BEHAVIORAL_BAND_KEYS: BehavioralBandKey[] = [
  'thrust',
  'fire',
  'turn',
  'turnBias',
]

function mergeBehavioralGateConfig(
  ...sources: Array<TrainingProfileConfig['behavioralGateConfig'] | undefined>
): TrainingProfileConfig['behavioralGateConfig'] | undefined {
  let merged: Record<string, unknown> | undefined

  for (const source of sources) {
    if (!isRecord(source)) continue
    merged = {
      ...(merged ?? {}),
    }

    for (const key of BEHAVIORAL_BAND_KEYS) {
      const band = source[key]
      if (isRecord(band)) {
        merged[key] = {
          ...(isRecord(merged[key]) ? (merged[key] as Record<string, unknown>) : {}),
          ...band,
        }
      }
    }

    if (typeof source.floor === 'number') {
      merged.floor = source.floor
    }
  }

  return merged as TrainingProfileConfig['behavioralGateConfig'] | undefined
}

export function mergeTrainingProfileConfig(
  ...sources: Array<TrainingProfileConfig | undefined>
): TrainingProfileConfig {
  const merged: TrainingProfileConfig = {}
  let mergedFitnessWeights: TrainingProfileConfig['fitnessWeights'] | undefined
  let mergedGateConfig: TrainingProfileConfig['gateConfig'] | undefined
  let mergedBehavioralGateConfig:
    | TrainingProfileConfig['behavioralGateConfig']
    | undefined
  let mergedRuntimeHooks: TrainingProfileConfig['runtimeHooks'] | undefined

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

    mergedBehavioralGateConfig = mergeBehavioralGateConfig(
      mergedBehavioralGateConfig,
      source.behavioralGateConfig
    )

    if (isRecord(source.runtimeHooks)) {
      mergedRuntimeHooks = {
        ...(mergedRuntimeHooks ?? {}),
        ...source.runtimeHooks,
      }
    }
  }

  if (mergedFitnessWeights != null) {
    merged.fitnessWeights = mergedFitnessWeights
  }

  if (mergedGateConfig != null) {
    merged.gateConfig = mergedGateConfig
  }

  if (mergedBehavioralGateConfig != null) {
    merged.behavioralGateConfig = mergedBehavioralGateConfig
  }

  if (mergedRuntimeHooks != null) {
    merged.runtimeHooks = mergedRuntimeHooks
  }

  return merged
}

export function mergeTrainingProfileHooks(
  ...sources: Array<TrainingProfileHooks | undefined>
): TrainingProfileHooks {
  const merged: TrainingProfileHooks = {}

  for (const source of sources) {
    if (source == null) continue
    if (typeof source.reward === 'string') {
      merged.reward = source.reward
    }
    if (typeof source.fitness === 'string') {
      merged.fitness = source.fitness
    }
  }

  return merged
}

export function mergeTrainingProfileMetadata(
  ...sources: Array<TrainingProfileMetadata | undefined>
): TrainingProfileMetadata {
  const merged: TrainingProfileMetadata = {}
  const tags = new Set<string>()

  for (const source of sources) {
    if (source == null) continue
    if (typeof source.label === 'string') merged.label = source.label
    if (typeof source.description === 'string') {
      merged.description = source.description
    }
    for (const tag of source.tags ?? []) {
      tags.add(tag)
    }
  }

  if (tags.size > 0) {
    merged.tags = [...tags]
  }

  return merged
}

export function finalizeResolvedTrainingProfile(
  chain: TrainingProfile[]
): ResolvedTrainingProfile {
  const selected = chain.at(-1)
  if (selected == null) {
    throw new Error('Cannot finalize an empty profile chain.')
  }

  const meta = mergeTrainingProfileMetadata(...chain.map((profile) => profile.meta))

  return {
    name: selected.name,
    label: meta.label ?? selected.name,
    selected,
    chain,
    config: mergeTrainingProfileConfig(...chain.map((profile) => profile.config)),
    hooks: mergeTrainingProfileHooks(...chain.map((profile) => profile.hooks)),
    meta,
  }
}

function appendUniqueProfile(
  chain: TrainingProfile[],
  added: Set<string>,
  profile: TrainingProfile
): void {
  const key = profile.name
  if (added.has(key)) return
  added.add(key)
  chain.push(profile)
}

export function resolveProfileChain(
  selected: TrainingProfile,
  options: {
    defaultProfile: TrainingProfile
    resolveBase: (ref: string) => TrainingProfile | undefined
  }
): ResolvedTrainingProfile {
  const chain: TrainingProfile[] = []
  const added = new Set<string>()
  const pending = new Set<string>()

  const visit = (profile: TrainingProfile): void => {
    if (profile.base != null) {
      const baseRef = profile.base
      if (pending.has(baseRef)) {
        throw new Error(`Profile base cycle detected at "${baseRef}".`)
      }

      pending.add(baseRef)
      const baseProfile = options.resolveBase(baseRef)
      if (baseProfile == null) {
        throw new Error(
          `Unable to resolve base profile "${baseRef}" for "${profile.name}".`
        )
      }
      visit(baseProfile)
      pending.delete(baseRef)
    }

    appendUniqueProfile(chain, added, profile)
  }

  appendUniqueProfile(chain, added, options.defaultProfile)
  visit(selected)

  return finalizeResolvedTrainingProfile(chain)
}
