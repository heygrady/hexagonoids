import type { RNG } from '@neat-evolution/utils'

import type { ScenarioSnapshot } from './types.js'

/**
 * Fisher-Yates partial shuffle: select `count` items uniformly at random.
 */
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

/**
 * Stratified sampling by `failureSignature`.
 *
 * Groups scenarios by their failure signature, then round-robins across
 * shuffled groups so every signature type gets roughly equal representation.
 * Falls back to uniform Fisher-Yates when there is only one group or no
 * signatures are present.
 */
export function stratifiedSample(
  bank: ScenarioSnapshot[],
  count: number,
  rng: RNG
): ScenarioSnapshot[] {
  if (count >= bank.length) {
    return bank.slice()
  }

  // Group by failureSignature
  const groupMap = new Map<string, ScenarioSnapshot[]>()
  for (const scenario of bank) {
    const key = scenario.failureSignature ?? 'none'
    let group = groupMap.get(key)
    if (group == null) {
      group = []
      groupMap.set(key, group)
    }
    group.push(scenario)
  }

  // Fall back to uniform sampling if only one group
  if (groupMap.size <= 1) {
    return fisherYatesSample(bank, count, rng)
  }

  // Shuffle the order of groups
  const groupKeys = fisherYatesSample(
    Array.from(groupMap.keys()),
    groupMap.size,
    rng
  )

  // Shuffle scenarios within each group
  const shuffledGroups = groupKeys.map((key) =>
    fisherYatesSample(groupMap.get(key)!, groupMap.get(key)!.length, rng)
  )

  // Round-robin across groups until we have enough
  const result: ScenarioSnapshot[] = []
  const groupIndices = new Array<number>(shuffledGroups.length).fill(0)

  while (result.length < count) {
    let added = false
    for (let g = 0; g < shuffledGroups.length; g++) {
      if (result.length >= count) break
      const group = shuffledGroups[g]!
      const idx = groupIndices[g]!
      if (idx < group.length) {
        result.push(group[idx]!)
        groupIndices[g] = idx + 1
        added = true
      }
    }
    // All groups exhausted (shouldn't happen since count < bank.length)
    if (!added) break
  }

  return result
}
