import type { RNG } from '@neat-evolution/utils'

import type { ScenarioSnapshot } from './types.js'

// ── Types ───────────────────────────────────────────────────────────────────

export interface StratifiedIndex {
  byNecklace: Map<number, ScenarioSnapshot[]>
  necklaceOrder: number[]
}

// ── Index builder ───────────────────────────────────────────────────────────

export function buildStratifiedIndex(
  bank: ScenarioSnapshot[]
): StratifiedIndex {
  const byNecklace = new Map<number, ScenarioSnapshot[]>()
  for (const s of bank) {
    const key = s.necklace ?? -1
    let group = byNecklace.get(key)
    if (group == null) {
      group = []
      byNecklace.set(key, group)
    }
    group.push(s)
  }
  const necklaceOrder = [...byNecklace.keys()].sort((a, b) => a - b)
  return { byNecklace, necklaceOrder }
}

// ── Fisher-Yates partial shuffle ────────────────────────────────────────────

function fisherYatesSample<T>(items: T[], count: number, rng: RNG): T[] {
  const arr = items.slice()
  const n = Math.min(count, arr.length)
  for (let i = 0; i < n; i++) {
    const j = i + Math.floor(rng.gen() * (arr.length - i))
    const temp = arr[i]!
    arr[i] = arr[j]!
    arr[j] = temp
  }
  return arr.slice(0, n)
}

// ── Signature diversity sort ────────────────────────────────────────────────

/**
 * Sort candidates so under-represented failure signatures appear first.
 * Scores each candidate as 1/(1 + globalCount[sig]) — lower global count = higher priority.
 */
function sortBySignatureDiversity(
  candidates: ScenarioSnapshot[],
  globalSignatureCounts: Map<string, number>
): ScenarioSnapshot[] {
  return candidates.slice().sort((a, b) => {
    const sigA = a.failureSignature ?? 'none'
    const sigB = b.failureSignature ?? 'none'
    const scoreA = 1 / (1 + (globalSignatureCounts.get(sigA) ?? 0))
    const scoreB = 1 / (1 + (globalSignatureCounts.get(sigB) ?? 0))
    return scoreB - scoreA // Higher score (rarer signature) first
  })
}

// ── Multi-dimensional stratified sample ─────────────────────────────────────

/**
 * Stratified sampling by necklace class (primary) with failure-signature
 * diversity within each class.
 *
 * Accepts either a pre-built `StratifiedIndex` (hot path) or a raw bank
 * array (backward compatible — builds index on the fly).
 */
export function stratifiedSample(
  bankOrIndex: ScenarioSnapshot[] | StratifiedIndex,
  count: number,
  rng: RNG
): ScenarioSnapshot[] {
  // Resolve index
  let index: StratifiedIndex
  let bankLength: number
  if (Array.isArray(bankOrIndex)) {
    if (count >= bankOrIndex.length) return bankOrIndex.slice()
    index = buildStratifiedIndex(bankOrIndex)
    bankLength = bankOrIndex.length
  } else {
    index = bankOrIndex
    bankLength = 0
    for (const group of index.byNecklace.values()) {
      bankLength += group.length
    }
    if (count >= bankLength) {
      const all: ScenarioSnapshot[] = []
      for (const group of index.byNecklace.values()) {
        for (const s of group) all.push(s)
      }
      return all
    }
  }

  const { byNecklace, necklaceOrder } = index
  const filledClassCount = necklaceOrder.length

  // Single class — fall back to shuffle + signature diversity
  if (filledClassCount <= 1) {
    const group = byNecklace.get(necklaceOrder[0] ?? -1) ?? []
    return fisherYatesSample(group, count, rng)
  }

  // Build global signature counts for diversity scoring
  const globalSignatureCounts = new Map<string, number>()
  for (const group of byNecklace.values()) {
    for (const s of group) {
      const sig = s.failureSignature ?? 'none'
      globalSignatureCounts.set(sig, (globalSignatureCounts.get(sig) ?? 0) + 1)
    }
  }

  // Per-necklace quotas
  const base = Math.floor(count / filledClassCount)
  let remainder = count - base * filledClassCount

  const result: ScenarioSnapshot[] = []
  const unused: ScenarioSnapshot[] = []

  // Shuffle necklace order for fair remainder distribution
  const shuffledOrder = fisherYatesSample(
    necklaceOrder,
    necklaceOrder.length,
    rng
  )

  for (const necklaceKey of shuffledOrder) {
    const group = byNecklace.get(necklaceKey)!
    const quota = base + (remainder > 0 ? 1 : 0)
    if (remainder > 0) remainder--

    // Shuffle within class
    const shuffled = fisherYatesSample(group, group.length, rng)

    // Sort by signature diversity (rarest signatures first)
    const sorted = sortBySignatureDiversity(shuffled, globalSignatureCounts)

    const take = Math.min(quota, sorted.length)
    for (let i = 0; i < take; i++) {
      result.push(sorted[i]!)
    }
    // Collect unused for backfill
    for (let i = take; i < sorted.length; i++) {
      unused.push(sorted[i]!)
    }
  }

  // Backfill if some classes had fewer than quota
  if (result.length < count && unused.length > 0) {
    const backfill = fisherYatesSample(unused, count - result.length, rng)
    for (const s of backfill) {
      result.push(s)
    }
  }

  return result
}
