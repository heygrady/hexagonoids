import type { DedupeReport, ScenarioCandidate } from './types.js'

function quantize(value: unknown, bucketSize: number): string {
  const num = Number(value)
  if (!Number.isFinite(num)) return 'na'
  return String(Math.round(num / bucketSize))
}

function disagreementScore(failureRate: number): number {
  if (failureRate <= 0 || failureRate >= 1) return 0
  return 1 - Math.abs(failureRate - 0.5) / 0.5
}

function candidateScore(candidate: ScenarioCandidate): number {
  return candidate.interestingness ?? 0
}

export function scoreInterestingness(
  candidate: ScenarioCandidate,
  clusterSize = 1
): number {
  const failureRate = candidate.annotations?.failureRate ?? 0
  const disagreement = disagreementScore(failureRate)
  const consensusHard = failureRate
  const uniqueness = 1 / Math.max(clusterSize, 1)
  const averageFitness = candidate.annotations?.averageFitness ?? 0
  const fitnessPenalty = 1 - Math.min(Math.max(averageFitness, 0), 1)
  const recoverabilityPenalty = candidate.annotations?.likelyUnrecoverable
    ? 0.15
    : 0

  return (
    disagreement * 0.45 +
    consensusHard * 0.3 +
    uniqueness * 0.15 +
    fitnessPenalty * 0.1 -
    recoverabilityPenalty
  )
}

function behaviorSignature(candidate: ScenarioCandidate) {
  const evaluations = candidate.annotations?.evaluations ?? []
  const failBits = evaluations.map((entry) => (entry.died ? '1' : '0')).join('')
  const avgFitnessBucket = quantize(
    candidate.annotations?.averageFitness ?? 0,
    0.1
  )

  return {
    failBits,
    avgFitnessBucket,
    wave: quantize(candidate.scenario?.wave, 1),
    difficulty: quantize(candidate.scenario?.difficulty, 0.1),
    rocks: quantize(candidate.summary?.rocks ?? 0, 4),
  }
}

function behaviorSignatureDistance(
  a: ReturnType<typeof behaviorSignature>,
  b: ReturnType<typeof behaviorSignature>
): number {
  const total = Math.max(a.failBits.length, b.failBits.length)
  if (total === 0) return 0

  let mismatches = 0
  for (let i = 0; i < total; i++) {
    if ((a.failBits[i] ?? '0') !== (b.failBits[i] ?? '0')) mismatches++
  }

  return mismatches / total
}

function canMergeByBehavior(
  candidate: ScenarioCandidate,
  cluster: {
    representative: ScenarioCandidate
    behaviorAnchor: ReturnType<typeof behaviorSignature>
    members: ScenarioCandidate[]
  }
): boolean {
  const signature = behaviorSignature(candidate)
  const anchor = cluster.behaviorAnchor

  if (signature.wave !== anchor.wave) return false
  if (signature.difficulty !== anchor.difficulty) return false

  const rockDiff = Math.abs(Number(signature.rocks) - Number(anchor.rocks))
  if (Number.isFinite(rockDiff) && rockDiff > 1) return false

  const distance = behaviorSignatureDistance(signature, anchor)
  const allowedDistance = signature.failBits.length <= 8 ? 0.125 : 0.2

  const fitnessDiff = Math.abs(
    Number(signature.avgFitnessBucket) - Number(anchor.avgFitnessBucket)
  )

  return (
    distance <= allowedDistance &&
    (!Number.isFinite(fitnessDiff) || fitnessDiff <= 1)
  )
}

export function dedupeCandidates(
  candidates: ScenarioCandidate[]
): DedupeReport {
  const sorted = [...candidates].sort(
    (a, b) => candidateScore(b) - candidateScore(a)
  )
  const behaviorClusters: Array<{
    representative: ScenarioCandidate
    behaviorAnchor: ReturnType<typeof behaviorSignature>
    members: ScenarioCandidate[]
  }> = []

  for (const candidate of sorted) {
    let matchedCluster = null

    for (const cluster of behaviorClusters) {
      if (canMergeByBehavior(candidate, cluster)) {
        matchedCluster = cluster
        break
      }
    }

    if (matchedCluster == null) {
      behaviorClusters.push({
        representative: candidate,
        behaviorAnchor: behaviorSignature(candidate),
        members: [candidate],
      })
      continue
    }

    matchedCluster.members.push(candidate)

    if (
      candidateScore(candidate) > candidateScore(matchedCluster.representative)
    ) {
      matchedCluster.representative = candidate
      matchedCluster.behaviorAnchor = behaviorSignature(candidate)
    }
  }

  const finalCandidates = behaviorClusters.map((cluster) => {
    const best = cluster.representative
    return {
      ...best,
      cluster: {
        size: cluster.members.length,
        behaviorSize: cluster.members.length,
        behaviorSignature: cluster.behaviorAnchor.failBits,
      },
      interestingness: scoreInterestingness(best, cluster.members.length),
    }
  })

  return {
    finalCandidates,
    behaviorPass: {
      inputCount: candidates.length,
      outputCount: finalCandidates.length,
      clusters: behaviorClusters.map((cluster) => ({
        representativeId: cluster.representative.id,
        representativeSourceId: cluster.representative.source.id,
        behaviorSize: cluster.members.length,
        behaviorSignature: cluster.behaviorAnchor.failBits,
      })),
    },
  }
}

export function trimFinalBank(
  candidates: ScenarioCandidate[],
  finalCount: number
): ScenarioCandidate[] {
  return [...candidates]
    .sort((a, b) => candidateScore(b) - candidateScore(a))
    .slice(0, finalCount)
}
