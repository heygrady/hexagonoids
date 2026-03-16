import type { RawMetrics } from './RawMetrics.js'

export interface ActionProfile {
  thrustPct: number
  firePct: number
  leftPct: number
  rightPct: number
  entropy: number
}

export interface MovementProfile {
  distanceTraveled: number
  uniqueCells: number
  idlePct: number
}

export interface EngagementProfile {
  framesWithRocksInSOIPct: number
}

export interface BehavioralProfile {
  action: ActionProfile
  movement: MovementProfile
  engagement: EngagementProfile
}

export function shannonEntropy(fractions: number[]): number {
  let h = 0
  for (const p of fractions) {
    if (p > 0) {
      h -= p * Math.log2(p)
    }
  }
  return h
}

/**
 * Compute behavioral profile from aggregated metrics.
 *
 * @param aggregated - RawMetrics aggregated across seeds (summed)
 * @param seedCount - Number of seeds aggregated (for averaging distance/cells)
 */
export function computeBehavioralProfile(
  aggregated: RawMetrics,
  seedCount: number
): BehavioralProfile {
  const alive = aggregated.aliveFrames || 1

  // Action profile (fractions are scale-invariant, so aggregated is fine)
  const thrustPct = aggregated.thrustFrames / alive
  const firePct = aggregated.fireFrames / alive
  const leftPct = aggregated.leftFrames / alive
  const rightPct = aggregated.rightFrames / alive
  const total = thrustPct + firePct + leftPct + rightPct
  const fractions =
    total > 0
      ? [thrustPct / total, firePct / total, leftPct / total, rightPct / total]
      : [0.25, 0.25, 0.25, 0.25]
  const entropy = shannonEntropy(fractions)

  // Movement profile
  const idleFrames =
    alive -
    Math.max(
      aggregated.thrustFrames,
      aggregated.leftFrames,
      aggregated.rightFrames
    )
  const idlePct = Math.max(0, idleFrames) / alive

  // Engagement (fraction is scale-invariant)
  const framesWithRocksInSOIPct = aggregated.framesWithRocksInSOI / alive

  return {
    action: { thrustPct, firePct, leftPct, rightPct, entropy },
    movement: {
      distanceTraveled: aggregated.distanceTraveled / seedCount,
      uniqueCells: Math.round(aggregated.uniqueCellsVisited / seedCount),
      idlePct,
    },
    engagement: { framesWithRocksInSOIPct },
  }
}
