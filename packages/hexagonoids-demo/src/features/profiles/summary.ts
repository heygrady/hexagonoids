import type { TrainOptions } from '../training/train.js'
import type { ResolvedTrainingProfile, TrainingProfileHooks } from './types.js'

function fmtNum(value: number | undefined, decimals = 3): string | undefined {
  if (value == null || !Number.isFinite(value)) return undefined
  return value.toFixed(decimals)
}

export function formatTrainingProfileHooks(
  hooks: TrainingProfileHooks | undefined
): string | null {
  if (hooks == null) return null
  const parts: string[] = []
  if (typeof hooks.reward === 'string') parts.push(`reward=${hooks.reward}`)
  if (typeof hooks.fitness === 'string') parts.push(`fitness=${hooks.fitness}`)
  return parts.length > 0 ? parts.join(' ') : null
}

export function summarizeResolvedProfileConfig(
  config: Partial<TrainOptions> | undefined
): string[] {
  if (config == null) return []

  const parts: string[] = []
  if (config.method != null) parts.push(`method=${config.method}`)
  if (config.populationSize != null) {
    parts.push(`population=${config.populationSize}`)
  }
  if (config.iterations != null) parts.push(`iterations=${config.iterations}`)

  if (
    config.scenarioWeight != null ||
    config.fullGameWeight != null ||
    config.curriculumWeight != null
  ) {
    parts.push(
      `blend=scenario:${fmtNum(config.scenarioWeight) ?? 'default'} full:${fmtNum(config.fullGameWeight) ?? 'default'} curriculum:${fmtNum(config.curriculumWeight) ?? 'default'}`
    )
  }

  if (config.behavioralGateConfig != null) {
    const behavioralParts: string[] = []
    const thrustHigh = fmtNum(config.behavioralGateConfig.thrust?.high)
    if (thrustHigh != null) behavioralParts.push(`thrust.high=${thrustHigh}`)
    const fireHigh = fmtNum(config.behavioralGateConfig.fire?.high)
    if (fireHigh != null) behavioralParts.push(`fire.high=${fireHigh}`)
    const turnHigh = fmtNum(config.behavioralGateConfig.turn?.high)
    if (turnHigh != null) behavioralParts.push(`turn.high=${turnHigh}`)
    const turnBiasMax = fmtNum(config.behavioralGateConfig.turnBias?.max)
    if (turnBiasMax != null) behavioralParts.push(`turnBias.max=${turnBiasMax}`)
    if (behavioralParts.length > 0) {
      parts.push(`behavioralGates=${behavioralParts.join(' ')}`)
    }
  }

  return parts
}

export function formatResolvedProfileSummary(
  profile: ResolvedTrainingProfile,
  config?: Partial<TrainOptions>
): string[] {
  const lines = [`Profile: ${profile.label} (${profile.name})`]
  const chain = profile.chain.map((entry) => entry.name)
  if (chain.length > 1) {
    lines.push(`Profile chain: ${chain.join(' -> ')}`)
  }
  const hooks = formatTrainingProfileHooks(profile.hooks)
  if (hooks != null) {
    lines.push(`Runtime hooks: ${hooks}`)
  }
  const configSummary = summarizeResolvedProfileConfig(
    (config ?? profile.config) as Partial<TrainOptions>
  )
  if (configSummary.length > 0) {
    lines.push(`Resolved config: ${configSummary.join('  ')}`)
  }
  return lines
}
