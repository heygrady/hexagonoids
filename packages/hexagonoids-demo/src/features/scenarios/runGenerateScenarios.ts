import { writeFileSync } from 'node:fs'
import { gzipSync } from 'node:zlib'
import { dedupeCandidates, scoreInterestingness } from './dedupe.js'
import { discoverSourceGenomes } from './discovery.js'
import {
  defaultScenarioOptions,
  EXPECTED_IO,
  EXPECTED_OUTPUTS,
} from './options.js'
import { makeOutputDocument, makeScenarioBank } from './output.js'
import {
  selectReviewPanel,
  selectReviewPanelFromSignatures,
  selectScoutCandidates,
  sortSourcesByFitness,
} from './panel.js'
import {
  loadExistingScenarioCandidates,
  loadScenarioRuntime,
} from './runtime.js'
import {
  attachConeMetadata,
  stratifiedSelectFinalBank,
} from './stratification.js'
import {
  printDedupeSummary,
  printFinalBankSummary,
  printPanelPerformanceSummary,
  printPanelSummary,
  printSourceSummary,
} from './summaries.js'
import type {
  PanelReport,
  ScenarioCandidate,
  ScenarioOptions,
  ScenarioRunCounts,
} from './types.js'
import { createScenarioWorkerPool } from './workerScenarioPool.js'

function applyBaseInterestingness(
  candidates: ScenarioCandidate[]
): ScenarioCandidate[] {
  return candidates.map((candidate) => ({
    ...candidate,
    interestingness: scoreInterestingness(candidate, 1),
  }))
}

async function runGenerateScenariosWithResolvedOptions(
  options: ScenarioOptions
) {
  console.log(
    `\n=== Robust Scenario Mining: labs=${options.maxLabs} heroes=${options.heroCount} perSource=${options.countPerSource} rewind=${options.rewind} killRatio=${options.killRatio} ===`
  )
  console.log(
    `Compatible genome filter: inputs=${EXPECTED_IO.inputs} outputs=${EXPECTED_OUTPUTS}`
  )

  const sourceReport = discoverSourceGenomes(options)
  printSourceSummary(sourceReport)

  if (options.dryRun) {
    console.log('\nDry run only. No scenario simulation performed.\n')
    return
  }

  if (sourceReport.sources.length === 0) {
    throw new Error('No compatible source genomes found.')
  }

  // Create worker pool for parallel execution
  const pool = await createScenarioWorkerPool()

  try {
    // Phase 1: Collect candidates (parallel — one task per source)
    const generatedCandidates = await pool.collectCandidatesParallel(
      sourceReport.sources,
      options
    )
    const existingBank = loadExistingScenarioCandidates(options)
    const rawCandidates = [...generatedCandidates, ...existingBank.candidates]

    console.log(
      `\nCollected ${generatedCandidates.length} generated candidates`
    )
    if (existingBank.candidates.length > 0) {
      console.log(
        `Merged ${existingBank.candidates.length} existing scenarios from: ${options.existing}`
      )
    }
    console.log(`Total raw candidate pool: ${rawCandidates.length}`)

    // Phase 2: Filter instant-death candidates (parallel — chunked across workers)
    const instantDeathFilter = await pool.filterInstantDeathParallel(
      rawCandidates,
      options
    )
    console.log(
      `Instant-death filter removed ${instantDeathFilter.removed.length}/${rawCandidates.length} candidates (ticks=${instantDeathFilter.instantDeathTicks}, trials=${options.instantDeathTrials})`
    )

    // Phase 3: Select review panel (parallel scouting, sequential greedy selection)
    const scoutCandidates = selectScoutCandidates(
      instantDeathFilter.kept,
      options.panelScoutCount
    )

    const sortedSources = sortSourcesByFitness(sourceReport.sources)
    let panelReport: PanelReport

    if (sortedSources.length > options.panelMax && scoutCandidates.length > 0) {
      // Use parallel scouting
      const signatures = await pool.scoutPanelParallel(
        sortedSources,
        scoutCandidates,
        options.evalTicks
      )

      // Build panel report with pre-computed signatures (needs runtime for handle creation)
      const runtime = await loadScenarioRuntime()
      panelReport = await selectReviewPanelFromSignatures(
        runtime,
        sourceReport.sources,
        signatures,
        scoutCandidates,
        options
      )
    } else {
      // Small source count or no scouts — sequential is fine
      const runtime = await loadScenarioRuntime()
      panelReport = await selectReviewPanel(
        runtime,
        sourceReport.sources,
        scoutCandidates,
        options
      )
    }
    printPanelSummary(panelReport)

    // Phase 4: Annotate candidates (parallel — chunked across workers)
    const panelSources = panelReport.panelHandles.map((h) => h.source)
    const annotated = applyBaseInterestingness(
      await pool.annotateCandidatesParallel(
        instantDeathFilter.kept,
        panelSources,
        options
      )
    )
    console.log(`Annotated ${annotated.length} candidates`)

    // Phase 5: Dedupe and trim (sequential — fast, data-only)
    const dedupeReport = dedupeCandidates(annotated)
    const deduped = dedupeReport.finalCandidates
    console.log(`Deduped to ${deduped.length} candidates`)

    const withCone = attachConeMetadata(deduped)
    const { selected: finalBank, coverage } = stratifiedSelectFinalBank(
      withCone,
      options.finalCount,
      options.killRatio
    )
    console.log(
      `Stratified final bank to ${finalBank.length} scenarios (${coverage.necklacesFilled}/36 necklace classes)`
    )

    printPanelPerformanceSummary(annotated, panelReport)
    printDedupeSummary(annotated, dedupeReport, finalBank)
    printFinalBankSummary(finalBank, coverage)

    const scenarioBank = makeScenarioBank(finalBank)
    const counts: ScenarioRunCounts = {
      discoveredSources: sourceReport.sources.length,
      reviewPanelSources: panelReport.panelHandles.length,
      rejectedSources: sourceReport.rejected.length,
      generatedCandidates: generatedCandidates.length,
      mergedExistingCandidates: existingBank.candidates.length,
      rawCandidates: rawCandidates.length,
      postInstantDeathCandidates: instantDeathFilter.kept.length,
      annotatedCandidates: annotated.length,
      dedupedCandidates: deduped.length,
      finalScenarios: finalBank.length,
    }

    const reportDocument = makeOutputDocument(
      options,
      sourceReport,
      panelReport,
      instantDeathFilter,
      finalBank,
      counts,
      coverage
    )

    const json = JSON.stringify(scenarioBank)
    const gzipped = gzipSync(new TextEncoder().encode(json))
    const compressed = Buffer.from(
      gzipped.buffer,
      gzipped.byteOffset,
      gzipped.byteLength
    ).toString('base64')
    const header =
      '// @generated -- do not edit. Regenerate with: yarn workspace @heygrady/hexagonoids-demo demo scenarios\n'
    writeFileSync(
      options.output,
      header + 'export default "' + compressed + '"\n'
    )
    console.log(`\nWritten ${finalBank.length} scenarios to: ${options.output}`)

    if (options.report != null) {
      writeFileSync(options.report, JSON.stringify(reportDocument, null, 2))
      console.log(`Written detailed report to: ${options.report}`)
    }

    console.log('')
  } finally {
    await pool.terminate()
  }
}

export async function runGenerateScenarios(
  options: Partial<ScenarioOptions> = {}
) {
  await runGenerateScenariosWithResolvedOptions({
    ...defaultScenarioOptions(),
    ...options,
  })
}
