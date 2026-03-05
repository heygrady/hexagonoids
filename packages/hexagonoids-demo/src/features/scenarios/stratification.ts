import {
  allNecklaceClasses,
  canonicalNecklace,
  coneOccupancyMask,
  encodeGameState,
  hammingDistance,
  popcount8,
  restoreSnapshot,
} from '@heygrady/hexagonoids-environment'

import type { ScenarioCandidate } from './types.js'

export interface StratifiedCoverage {
  necklacesFilled: number
  totalSlotsFilled: number
  perClassCounts: Map<number, number>
  perClassKills: Map<number, number>
  perClassCrashes: Map<number, number>
  rockBucketDistribution: number[]
}

// 8 rock-count buckets: [1-3, 4-6, 7-9, 10-12, 13-16, 17-20, 21-25, 26+]
const ROCK_BUCKET_BOUNDARIES = [3, 6, 9, 12, 16, 20, 25, Infinity]

function rockBucketIndex(rocks: number): number {
  for (let i = 0; i < ROCK_BUCKET_BOUNDARIES.length; i++) {
    if (rocks <= ROCK_BUCKET_BOUNDARIES[i]!) return i
  }
  return ROCK_BUCKET_BOUNDARIES.length - 1
}

function candidateScore(candidate: ScenarioCandidate): number {
  return candidate.interestingness ?? 0
}

/**
 * Attach cone occupancy metadata to each candidate by restoring the snapshot
 * and encoding the game state. Candidates with malformed snapshots are kept
 * but without cone metadata.
 */
export function attachConeMetadata(
  candidates: ScenarioCandidate[]
): ScenarioCandidate[] {
  return candidates.map((candidate) => {
    try {
      const engine = restoreSnapshot(candidate.scenario)
      const inputs = encodeGameState(
        engine.state,
        'player-1',
        undefined,
        undefined,
        undefined,
        engine
      )
      const mask = coneOccupancyMask(inputs)
      return {
        ...candidate,
        cone: {
          mask,
          necklace: canonicalNecklace(mask),
          popcount: popcount8(mask),
        },
      }
    } catch {
      return candidate
    }
  })
}

/**
 * Select scenarios with rock-count diversity within a pool.
 * Round-robins across rock-count buckets, picking top interestingness within each.
 */
function selectWithRockDiversity(
  pool: ScenarioCandidate[],
  target: number
): ScenarioCandidate[] {
  if (pool.length <= target) return [...pool]

  // Index by rock-count bucket, sorted by interestingness within each
  const buckets: ScenarioCandidate[][] = Array.from(
    { length: ROCK_BUCKET_BOUNDARIES.length },
    () => []
  )
  for (const c of pool) {
    const idx = rockBucketIndex(c.summary.rocks)
    buckets[idx]!.push(c)
  }
  for (const bucket of buckets) {
    bucket.sort((a, b) => candidateScore(b) - candidateScore(a))
  }

  const selected: ScenarioCandidate[] = []
  const cursors = new Array<number>(buckets.length).fill(0)

  // Round-robin across populated buckets
  while (selected.length < target) {
    let added = false
    for (let b = 0; b < buckets.length && selected.length < target; b++) {
      if (cursors[b]! < buckets[b]!.length) {
        selected.push(buckets[b]![cursors[b]!]!)
        cursors[b]!++
        added = true
      }
    }
    if (!added) break
  }

  return selected
}

/**
 * Stratified selection of final scenario bank across necklace equivalence
 * classes, capture type, and rock-count diversity.
 */
export function stratifiedSelectFinalBank(
  candidates: ScenarioCandidate[],
  finalCount: number,
  killRatio = 0.5
): { selected: ScenarioCandidate[]; coverage: StratifiedCoverage } {
  const necklaces = allNecklaceClasses()
  const perClass = Math.floor(finalCount / necklaces.length)
  const killPerClass = Math.round(perClass * killRatio)
  const crashPerClass = perClass - killPerClass

  // Index candidates by (necklace, captureType)
  const killsByNecklace = new Map<number, ScenarioCandidate[]>()
  const crashesByNecklace = new Map<number, ScenarioCandidate[]>()
  const noCone: ScenarioCandidate[] = []

  for (const n of necklaces) {
    killsByNecklace.set(n, [])
    crashesByNecklace.set(n, [])
  }

  for (const c of candidates) {
    if (c.cone == null) {
      noCone.push(c)
      continue
    }
    const isKill = c.scenario?.captureType === 'kill'
    const map = isKill ? killsByNecklace : crashesByNecklace
    const bucket = map.get(c.cone.necklace)
    if (bucket != null) {
      bucket.push(c)
    }
  }

  const selected: ScenarioCandidate[] = []
  const selectedIds = new Set<string>()
  const perClassCounts = new Map<number, number>()
  const perClassKills = new Map<number, number>()
  const perClassCrashes = new Map<number, number>()

  // Phase 1: Fill strata with rock diversity
  for (const n of necklaces) {
    const kills = selectWithRockDiversity(killsByNecklace.get(n)!, killPerClass)
    const crashes = selectWithRockDiversity(
      crashesByNecklace.get(n)!,
      crashPerClass
    )

    let classKills = 0
    let classCrashes = 0

    for (const c of kills) {
      if (!selectedIds.has(c.id)) {
        selected.push(c)
        selectedIds.add(c.id)
        classKills++
      }
    }
    for (const c of crashes) {
      if (!selectedIds.has(c.id)) {
        selected.push(c)
        selectedIds.add(c.id)
        classCrashes++
      }
    }

    perClassCounts.set(n, classKills + classCrashes)
    perClassKills.set(n, classKills)
    perClassCrashes.set(n, classCrashes)
  }

  // Phase 2: Redistribute from underfilled classes to Hamming-1 neighbors
  const underfilled: number[] = []
  const surplus = new Map<number, ScenarioCandidate[]>()

  for (const n of necklaces) {
    const count = perClassCounts.get(n)!
    if (count < perClass) {
      underfilled.push(n)
    } else {
      // Gather unused candidates from this class as surplus
      const unusedKills = killsByNecklace
        .get(n)!
        .filter((c) => !selectedIds.has(c.id))
      const unusedCrashes = crashesByNecklace
        .get(n)!
        .filter((c) => !selectedIds.has(c.id))
      const all = [...unusedKills, ...unusedCrashes].sort(
        (a, b) => candidateScore(b) - candidateScore(a)
      )
      if (all.length > 0) {
        surplus.set(n, all)
      }
    }
  }

  for (const n of underfilled) {
    const deficit = perClass - perClassCounts.get(n)!
    if (deficit <= 0) continue

    // Find Hamming-1 neighbors with surplus
    const neighbors = necklaces
      .filter((other) => other !== n && hammingDistance(n, other) === 1)
      .filter((other) => surplus.has(other))

    let filled = 0
    for (const neighbor of neighbors) {
      if (filled >= deficit) break
      const pool = surplus.get(neighbor)!
      while (pool.length > 0 && filled < deficit) {
        const c = pool.shift()!
        if (!selectedIds.has(c.id)) {
          selected.push(c)
          selectedIds.add(c.id)
          perClassCounts.set(n, perClassCounts.get(n)! + 1)
          if (c.scenario?.captureType === 'kill') {
            perClassKills.set(n, (perClassKills.get(n) ?? 0) + 1)
          } else {
            perClassCrashes.set(n, (perClassCrashes.get(n) ?? 0) + 1)
          }
          filled++
        }
      }
      if (pool.length === 0) surplus.delete(neighbor)
    }
  }

  // Phase 3: Global backfill by interestingness
  if (selected.length < finalCount) {
    const remaining = [...candidates, ...noCone]
      .filter((c) => !selectedIds.has(c.id))
      .sort((a, b) => candidateScore(b) - candidateScore(a))

    for (const c of remaining) {
      if (selected.length >= finalCount) break
      selected.push(c)
      selectedIds.add(c.id)
    }
  }

  // Trim to exact count
  const final = selected.slice(0, finalCount)

  // Compute rock bucket distribution
  const rockBucketDistribution = new Array<number>(
    ROCK_BUCKET_BOUNDARIES.length
  ).fill(0)
  for (const c of final) {
    const idx = rockBucketIndex(c.summary.rocks)
    rockBucketDistribution[idx]!++
  }

  // Recount filled necklaces from final selection
  let necklacesFilled = 0
  for (const n of necklaces) {
    const count = final.filter((c) => c.cone?.necklace === n).length
    if (count > 0) necklacesFilled++
  }

  return {
    selected: final,
    coverage: {
      necklacesFilled,
      totalSlotsFilled: final.length,
      perClassCounts,
      perClassKills,
      perClassCrashes,
      rockBucketDistribution,
    },
  }
}
