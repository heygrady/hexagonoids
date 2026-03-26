import type {
  GauntletBreakdown,
  RewardBreakdown,
} from '@heygrady/hexagonoids-environment'

export interface AlignmentSummaryOptions {
  topN?: number
  showComponents?: boolean
  showModes?: boolean
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
): Array<[keyof RewardBreakdown, number]> {
  return [
    ['survival', breakdown.survival],
    ['thrust', breakdown.thrust],
    ['engagement', breakdown.engagement],
    ['progress', breakdown.progress],
    ['kill', breakdown.kill],
    ['score', breakdown.score],
    ['aim', breakdown.aim],
    ['shotPenalty', breakdown.shotPenalty],
    ['death', breakdown.death],
    ['waveBonus', breakdown.waveBonus],
    ['actionBand', breakdown.actionBand],
    ['total', breakdown.total],
  ]
}

function actionFractions(breakdown: GauntletBreakdown): string {
  const { aggregatedFrames } = breakdown
  if (aggregatedFrames.aliveFrames <= 0) return 'alive=0'
  const alive = aggregatedFrames.aliveFrames
  const turnFrames = aggregatedFrames.leftFrames + aggregatedFrames.rightFrames
  const turnBias =
    turnFrames > 0
      ? Math.max(aggregatedFrames.leftFrames, aggregatedFrames.rightFrames) /
        turnFrames
      : 0
  return [
    `thrust=${pct(aggregatedFrames.thrustFrames / alive)}`,
    `fire=${pct(aggregatedFrames.fireFrames / alive)}`,
    `turn=${pct(turnFrames / alive)}`,
    `bias=${fmtNum(turnBias, 2)}`,
  ].join(' ')
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

  if (showComponents) {
    const componentLines =
      rewards.length > 0
        ? rewardComponentEntries(rewards[0] as RewardBreakdown)
            .map(([key]) => {
              const values = rewards.map((reward) => reward[key] as number)
              return `${String(key)}:${fmtNum(
                pearsonCorrelation(values, fitRaw),
                2
              )}`
            })
            .join('  ')
        : ''
    if (componentLines.length > 0) {
      lines.push(`  Components(raw): ${componentLines}`)
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
