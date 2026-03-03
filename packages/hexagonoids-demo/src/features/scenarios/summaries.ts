import type {
  DedupeReport,
  PanelReport,
  ScenarioCandidate,
  SourceReport,
} from './types.js'

function formatPct(value: number): string {
  return `${(value * 100).toFixed(0)}%`
}

function candidateScore(entry: ScenarioCandidate): number {
  return entry.interestingness ?? 0
}

export function printSourceSummary(sourceReport: SourceReport): void {
  console.log('\n── Source Discovery ──')
  console.log(`  compatible sources: ${sourceReport.sources.length}`)
  console.log(`  rejected sources: ${sourceReport.rejected.length}`)
  console.log(`  source kinds: ${sourceReport.kinds.join(', ') || 'none'}`)

  const byKind = new Map()
  for (const source of sourceReport.sources) {
    byKind.set(source.kind, (byKind.get(source.kind) || 0) + 1)
  }
  for (const [kind, count] of [...byKind.entries()].sort()) {
    console.log(`  ${kind}: ${count}`)
  }

  if (sourceReport.rejected.length > 0) {
    const incompatible = sourceReport.rejected.filter((entry) =>
      entry.reason.startsWith('incompatible io')
    ).length
    const malformed = sourceReport.rejected.length - incompatible
    console.log(
      `  rejections by reason: incompatible=${incompatible} malformed=${malformed}`
    )
  }
}

export function printPanelSummary(panelReport: PanelReport): void {
  console.log('\n── Review Panel ──')
  console.log(`  selection mode: ${panelReport.selectionMode}`)
  console.log(`  panel size: ${panelReport.panelHandles.length}`)
  console.log(`  scout scenarios: ${panelReport.scoutCandidates.length}`)

  const byKind = new Map()
  const byLab = new Set()
  for (const handle of panelReport.panelHandles) {
    byKind.set(handle.source.kind, (byKind.get(handle.source.kind) || 0) + 1)
    byLab.add(handle.source.labId)
  }
  console.log(`  represented labs: ${byLab.size}`)
  for (const [kind, count] of [...byKind.entries()].sort()) {
    console.log(`  ${kind}: ${count}`)
  }
}

export function printPanelPerformanceSummary(
  annotated: ScenarioCandidate[],
  panelReport: PanelReport
): void {
  console.log('\n── Panel Performance ──')

  const totals = new Map()
  for (const handle of panelReport.panelHandles) {
    totals.set(handle.id, {
      sourceId: handle.source.id,
      failures: 0,
      scenarios: 0,
      totalFitness: 0,
    })
  }

  for (const candidate of annotated) {
    for (const evaluation of candidate.annotations?.evaluations ?? []) {
      const entry = totals.get(evaluation.agentId)
      if (entry == null) continue
      entry.scenarios += 1
      entry.totalFitness += evaluation.fitness
      if (evaluation.died) entry.failures += 1
    }
  }

  const rows = [...totals.values()].sort((a, b) => {
    const aRate = a.scenarios > 0 ? a.failures / a.scenarios : 0
    const bRate = b.scenarios > 0 ? b.failures / b.scenarios : 0
    return bRate - aRate
  })

  for (const row of rows) {
    const failRate = row.scenarios > 0 ? row.failures / row.scenarios : 0
    const avgFitness = row.scenarios > 0 ? row.totalFitness / row.scenarios : 0
    console.log(
      `  ${row.sourceId}: fail=${row.failures}/${row.scenarios} (${formatPct(failRate)}) avgFit=${avgFitness.toFixed(3)}`
    )
  }
}

export function printDedupeSummary(
  annotated: ScenarioCandidate[],
  dedupeReport: DedupeReport,
  finalBank: ScenarioCandidate[]
): void {
  console.log('\n── Dedupe Analysis ──')

  const behaviorOutput = dedupeReport.behaviorPass.outputCount
  const collapsed = annotated.length - behaviorOutput
  const collapseRate = annotated.length > 0 ? collapsed / annotated.length : 0
  const behaviorMerged = dedupeReport.behaviorPass.clusters.filter(
    (entry) => entry.behaviorSize > 1
  ).length
  const maxBehaviorSize = dedupeReport.finalCandidates.reduce(
    (max, entry) => Math.max(max, entry.cluster?.behaviorSize ?? 1),
    1
  )

  console.log(
    `  collapsed: ${collapsed}/${annotated.length} (${formatPct(collapseRate)})`
  )
  console.log(
    `  behavior pass: ${annotated.length} -> ${behaviorOutput} (collapsed ${collapsed})`
  )
  console.log(
    `  behavior merges: ${behaviorMerged} clusters  max cluster size: ${maxBehaviorSize}`
  )

  const signatureGroups = new Map()
  for (const entry of dedupeReport.finalCandidates) {
    const signature = entry.cluster?.behaviorSignature ?? 'none'
    const bucket = signatureGroups.get(signature) ?? {
      signature,
      clusters: 0,
      scenarios: 0,
      selected: 0,
    }
    bucket.clusters += 1
    bucket.scenarios += entry.cluster?.behaviorSize ?? 1
    signatureGroups.set(signature, bucket)
  }
  for (const entry of finalBank) {
    const signature = entry.cluster?.behaviorSignature ?? 'none'
    const bucket = signatureGroups.get(signature)
    if (bucket != null) bucket.selected += 1
  }

  const topGroups = [...signatureGroups.values()]
    .sort((a, b) => b.scenarios - a.scenarios || b.selected - a.selected)
    .slice(0, 8)

  console.log('  top failure signatures:')
  for (const group of topGroups) {
    console.log(
      `    ${group.signature}: clusters=${group.clusters} scenarios=${group.scenarios} selected=${group.selected}`
    )
  }
}

export function printFinalBankSummary(finalBank: ScenarioCandidate[]): void {
  console.log('\n── Final Bank ──')

  const sourceKinds = new Map()
  let likelyUnrecoverable = 0
  let totalInterestingness = 0
  let deathCount = 0
  let killCount = 0
  const velocityTiers = { low: 0, mid: 0, high: 0 }
  for (const entry of finalBank) {
    sourceKinds.set(
      entry.source.kind,
      (sourceKinds.get(entry.source.kind) || 0) + 1
    )
    if (entry.annotations?.likelyUnrecoverable) likelyUnrecoverable++
    totalInterestingness += entry.interestingness ?? 0

    if (entry.scenario?.captureType === 'kill') {
      killCount++
    } else {
      deathCount++
    }

    // Velocity tier
    const ship = entry.scenario?.ship
    if (ship != null) {
      const speed = Math.sqrt(
        ship.angularVelocityX ** 2 +
          ship.angularVelocityY ** 2 +
          ship.angularVelocityZ ** 2
      )
      if (speed < 0.1) velocityTiers.low++
      else if (speed <= 0.25) velocityTiers.mid++
      else velocityTiers.high++
    }
  }

  console.log(`  death scenarios: ${deathCount}  kill scenarios: ${killCount}`)
  console.log(
    `  velocity tiers: low=${velocityTiers.low} mid=${velocityTiers.mid} high=${velocityTiers.high}`
  )
  console.log(
    `  likely unrecoverable: ${likelyUnrecoverable}/${finalBank.length}`
  )
  if (finalBank.length > 0) {
    console.log(
      `  mean interestingness: ${(totalInterestingness / finalBank.length).toFixed(3)}`
    )
  }

  const failureBuckets = [
    { label: '0-20%', min: 0, max: 0.2, count: 0 },
    { label: '20-40%', min: 0.2, max: 0.4, count: 0 },
    { label: '40-60%', min: 0.4, max: 0.6, count: 0 },
    { label: '60-80%', min: 0.6, max: 0.8, count: 0 },
    { label: '80-100%', min: 0.8, max: 1.0000001, count: 0 },
  ]

  for (const entry of finalBank) {
    const rate = entry.annotations?.failureRate ?? 0
    const bucket = failureBuckets.find(
      (item) => rate >= item.min && rate < item.max
    )
    if (bucket != null) bucket.count += 1
  }

  console.log('  failure-rate buckets:')
  for (const bucket of failureBuckets) {
    console.log(`    ${bucket.label}: ${bucket.count}`)
  }

  for (const [kind, count] of [...sourceKinds.entries()].sort()) {
    console.log(`  source ${kind}: ${count}`)
  }

  const topSelected = [...finalBank]
    .sort((a, b) => candidateScore(b) - candidateScore(a))
    .slice(0, 8)
  console.log('  top selected clusters:')
  for (const entry of topSelected) {
    console.log(
      `    score=${candidateScore(entry).toFixed(3)} sig=${entry.cluster?.behaviorSignature ?? 'none'} beh=${entry.cluster?.behaviorSize ?? 1} source=${entry.source.kind}`
    )
  }
}
