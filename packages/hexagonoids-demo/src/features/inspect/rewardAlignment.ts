import {
  REWARD_CATEGORY_COMPONENTS,
  REWARD_COMPONENTS,
  rewardCategoryTotal,
} from '@heygrady/hexagonoids-environment'
import type {
  GauntletBreakdown,
  RewardCategory,
  RewardComponent,
  RewardBreakdown,
} from '@heygrady/hexagonoids-environment'

export interface AlignmentSummaryOptions {
  topN?: number
  showComponents?: boolean
  showModes?: boolean
  showFitnessViews?: boolean
}

export function pearsonCorrelation(xs: number[], ys: number[]): number {
  const n = xs.length
  if (n < 2) return 0

  let sumX = 0
  let sumY = 0
  for (let i = 0; i < n; i++) {
    sumX += xs[i] as number
    sumY += ys[i] as number
  }
  const meanX = sumX / n
  const meanY = sumY / n

  let cov = 0
  let varX = 0
  let varY = 0
  for (let i = 0; i < n; i++) {
    const dx = (xs[i] as number) - meanX
    const dy = (ys[i] as number) - meanY
    cov += dx * dy
    varX += dx * dx
    varY += dy * dy
  }

  const denom = Math.sqrt(varX * varY)
  return denom < 1e-12 ? 0 : cov / denom
}

export function fmtNum(n: number, decimals = 4): string {
  return n.toFixed(decimals)
}

function pct(value: number): string {
  return `${(value * 100).toFixed(1)}%`
}

export function rewardComponentEntries(
  breakdown: RewardBreakdown
): Array<[RewardComponent | 'total', number]> {
  return [
    ...REWARD_COMPONENTS.map(
      (key): [RewardComponent, number] => [key, breakdown[key]]
    ),
    ['total', breakdown.total],
  ]
}

function rewardCategoryLabel(category: RewardCategory): string {
  switch (category) {
    case 'sparseObjective':
      return 'objective'
    case 'denseShaping':
      return 'shaping'
    case 'behaviorCost':
      return 'behaviorCost'
  }
}

function actionFractions(breakdown: GauntletBreakdown): string {
  const { aggregatedFrames } = breakdown
  if (aggregatedFrames.aliveFrames <= 0) return 'alive=0'
  const alive = aggregatedFrames.aliveFrames
  const turnFrames = aggregatedFrames.turnFrames
  const directionalTurns =
    aggregatedFrames.leftFrames + aggregatedFrames.rightFrames
  const turnBias =
    directionalTurns > 0
      ? Math.max(aggregatedFrames.leftFrames, aggregatedFrames.rightFrames) /
        directionalTurns
      : 0
  return [
    `thrust=${pct(aggregatedFrames.thrustFrames / alive)}`,
    `fire=${pct(aggregatedFrames.fireFrames / alive)}`,
    `turn=${pct(turnFrames / alive)}`,
    `conflict=${pct(aggregatedFrames.turnConflictFrames / alive)}`,
    `ambig=${pct(aggregatedFrames.turnAmbiguousFrames / alive)}`,
    `bias=${fmtNum(turnBias, 2)}`,
  ].join(' ')
}

type FitnessViewKey =
  | 'raw'
  | 'gate'
  | 'previewSqrt'
  | 'previewThrust'
  | 'previewFire'
  | 'previewTurn'
  | 'previewBias'

function fitnessViewValue(
  breakdown: GauntletBreakdown,
  key: FitnessViewKey
): number {
  switch (key) {
    case 'raw':
      return breakdown.blendedFitnessRaw
    case 'gate':
      return breakdown.gates.combined
    case 'previewSqrt':
      return breakdown.blendedFitnessRaw * Math.sqrt(breakdown.gates.combined)
    case 'previewThrust':
      return breakdown.blendedFitnessRaw * breakdown.gates.thrust
    case 'previewFire':
      return breakdown.blendedFitnessRaw * breakdown.gates.fire
    case 'previewTurn':
      return breakdown.blendedFitnessRaw * breakdown.gates.turn
    case 'previewBias':
      return breakdown.blendedFitnessRaw * breakdown.gates.turnBias
  }
}

function fitnessViewLabel(key: FitnessViewKey): string {
  switch (key) {
    case 'raw':
      return 'raw'
    case 'gate':
      return 'gate'
    case 'previewSqrt':
      return 'raw*sqrt(gate)'
    case 'previewThrust':
      return 'raw*thrustGate'
    case 'previewFire':
      return 'raw*fireGate'
    case 'previewTurn':
      return 'raw*turnGate'
    case 'previewBias':
      return 'raw*biasGate'
  }
}

export function formatRewardBreakdown(
  breakdown: RewardBreakdown,
  includeTotal = true
): string {
  const parts = rewardComponentEntries(breakdown)
    .filter(([key, value]) => (includeTotal || key !== 'total') && value !== 0)
    .map(([key, value]) => `${String(key)}=${fmtNum(value, 3)}`)
  return parts.length > 0 ? parts.join(' ') : 'all=0'
}

function rankTop(
  breakdowns: GauntletBreakdown[],
  getter: (b: GauntletBreakdown) => number,
  topN: number
): Array<{ index: number; breakdown: GauntletBreakdown }> {
  return breakdowns
    .map((breakdown, index) => ({ index, breakdown }))
    .sort((a, b) => getter(b.breakdown) - getter(a.breakdown))
    .slice(0, topN)
}

export function summarizeGenerationAlignment(
  iteration: number,
  speciesCount: number,
  breakdowns: GauntletBreakdown[],
  options: AlignmentSummaryOptions = {}
): string[] {
  const topN = options.topN ?? 3
  const showComponents = options.showComponents ?? false
  const showModes = options.showModes ?? false
  const showFitnessViews = options.showFitnessViews ?? false
  const fitGated = breakdowns.map((b) => b.fitness)
  const fitRaw = breakdowns.map((b) => b.blendedFitnessRaw)
  const rewards = breakdowns.map((b) => b.rewardBreakdown)
  const totalRewards = rewards.map((r) => r.total)
  const corrGated = pearsonCorrelation(fitGated, totalRewards)
  const corrRaw = pearsonCorrelation(fitRaw, totalRewards)

  const bestFit = rankTop(breakdowns, (b) => b.fitness, topN)
  const bestRaw = rankTop(breakdowns, (b) => b.blendedFitnessRaw, topN)
  const bestReward = rankTop(breakdowns, (b) => b.rewardBreakdown.total, topN)

  const lines = [
    `Gen ${String(iteration).padStart(2)}: species=${String(speciesCount).padStart(2)} rTotal->fit=${fmtNum(corrGated, 2)} rTotal->raw=${fmtNum(corrRaw, 2)}`,
  ]

  if (showFitnessViews) {
    const viewKeys: FitnessViewKey[] = [
      'gate',
      'previewSqrt',
      'previewThrust',
      'previewFire',
      'previewTurn',
      'previewBias',
    ]
    const parts = viewKeys.map((key) => {
      const values = breakdowns.map((breakdown) => fitnessViewValue(breakdown, key))
      return `${fitnessViewLabel(key)}:${fmtNum(
        pearsonCorrelation(values, totalRewards),
        2
      )}`
    })
    lines.push(`  fitnessViews: ${parts.join('  ')}`)
  }

  if (showComponents) {
    for (const category of Object.keys(
      REWARD_CATEGORY_COMPONENTS
    ) as RewardCategory[]) {
      const categoryLabel = rewardCategoryLabel(category)
      const categoryCorr = pearsonCorrelation(
        rewards.map((reward) => rewardCategoryTotal(reward, category)),
        fitRaw
      )
      const componentLines = REWARD_CATEGORY_COMPONENTS[category]
        .map((key) => {
          const values = rewards.map((reward) => reward[key])
          return `${key}:${fmtNum(pearsonCorrelation(values, fitRaw), 2)}`
        })
        .join('  ')
      lines.push(
        `  ${categoryLabel}(raw): total:${fmtNum(categoryCorr, 2)}  ${componentLines}`
      )
    }
  }

  const appendRanked = (
    label: string,
    ranked: Array<{ index: number; breakdown: GauntletBreakdown }>
  ) => {
    lines.push(`  Top ${label}:`)
    for (const { index, breakdown } of ranked) {
      lines.push(
        `    #${index} fit=${fmtNum(breakdown.fitness, 3)} raw=${fmtNum(breakdown.blendedFitnessRaw, 3)} reward=${fmtNum(breakdown.rewardBreakdown.total, 3)} gate=${fmtNum(breakdown.gates.combined, 3)} ${actionFractions(breakdown)}`
      )
      if (showFitnessViews) {
        lines.push(
          `      views: raw*sqrt(gate)=${fmtNum(
            fitnessViewValue(breakdown, 'previewSqrt'),
            3
          )} raw*thrust=${fmtNum(
            fitnessViewValue(breakdown, 'previewThrust'),
            3
          )} raw*fire=${fmtNum(
            fitnessViewValue(breakdown, 'previewFire'),
            3
          )} raw*turn=${fmtNum(
            fitnessViewValue(breakdown, 'previewTurn'),
            3
          )} raw*bias=${fmtNum(
            fitnessViewValue(breakdown, 'previewBias'),
            3
          )}`
        )
        lines.push(
          `      gates: thrust=${fmtNum(breakdown.gates.thrust, 3)} fire=${fmtNum(
            breakdown.gates.fire,
            3
          )} turn=${fmtNum(breakdown.gates.turn, 3)} bias=${fmtNum(
            breakdown.gates.turnBias,
            3
          )} combined=${fmtNum(breakdown.gates.combined, 3)}`
        )
      }
      lines.push(
        `      rewards: ${formatRewardBreakdown(breakdown.rewardBreakdown)}`
      )
      if (showModes) {
        lines.push(
          `      byMode: scenarios[${formatRewardBreakdown(
            breakdown.rewardBreakdownByMode.scenarios,
            false
          )}] fullGame[${formatRewardBreakdown(
            breakdown.rewardBreakdownByMode.fullGame,
            false
          )}] curriculum[${formatRewardBreakdown(
            breakdown.rewardBreakdownByMode.curriculum,
            false
          )}]`
        )
      }
    }
  }

  appendRanked('fitness', bestFit)
  appendRanked('raw', bestRaw)
  appendRanked('reward', bestReward)

  return lines
}
