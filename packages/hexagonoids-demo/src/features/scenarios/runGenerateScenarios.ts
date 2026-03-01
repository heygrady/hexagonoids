import { writeFileSync } from 'node:fs'
import {
  annotateCandidates,
  filterInstantDeathCandidates,
} from './annotation.js'
import {
  dedupeCandidates,
  scoreInterestingness,
  trimFinalBank,
} from './dedupe.js'
import { discoverSourceGenomes } from './discovery.js'
import { EXPECTED_IO, parseScenarioArgs } from './options.js'
import { makeOutputDocument, makeScenarioBank } from './output.js'
import { selectReviewPanel, selectScoutCandidates } from './panel.js'
import {
  collectCandidateScenarios,
  loadExistingScenarioCandidates,
  loadScenarioRuntime,
} from './runtime.js'
import {
  printDedupeSummary,
  printFinalBankSummary,
  printPanelPerformanceSummary,
  printPanelSummary,
  printSourceSummary,
} from './summaries.js'
import type { ScenarioCandidate, ScenarioRunCounts } from './types.js'

function applyBaseInterestingness(
  candidates: ScenarioCandidate[]
): ScenarioCandidate[] {
  return candidates.map((candidate) => ({
    ...candidate,
    interestingness: scoreInterestingness(candidate, 1),
  }))
}

export async function runGenerateScenarios(args: string[] = []) {
  const options = parseScenarioArgs(args)

  console.log(
    `\n=== Robust Scenario Mining: labs=${options.maxLabs} heroes=${options.heroCount} perSource=${options.countPerSource} rewind=${options.rewind} ===`
  )
  console.log(
    `Compatible genome filter: inputs=${EXPECTED_IO.inputs} outputs=${EXPECTED_IO.outputs}`
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

  const runtime = await loadScenarioRuntime()
  const generatedCandidates = await collectCandidateScenarios(
    runtime,
    sourceReport.sources,
    options
  )
  const existingBank = loadExistingScenarioCandidates(options)
  const rawCandidates = [...generatedCandidates, ...existingBank.candidates]

  console.log(`\nCollected ${generatedCandidates.length} generated candidates`)
  if (existingBank.candidates.length > 0) {
    console.log(
      `Merged ${existingBank.candidates.length} existing scenarios from: ${options.existing}`
    )
  }
  console.log(`Total raw candidate pool: ${rawCandidates.length}`)

  const instantDeathFilter = filterInstantDeathCandidates(
    runtime,
    rawCandidates,
    options
  )
  console.log(
    `Instant-death filter removed ${instantDeathFilter.removed.length}/${rawCandidates.length} candidates (ticks=${instantDeathFilter.instantDeathTicks}, trials=${options.instantDeathTrials})`
  )

  const scoutCandidates = selectScoutCandidates(
    instantDeathFilter.kept,
    options.panelScoutCount
  )
  const panelReport = await selectReviewPanel(
    runtime,
    sourceReport.sources,
    scoutCandidates,
    options
  )
  printPanelSummary(panelReport)

  const annotated = applyBaseInterestingness(
    await annotateCandidates(
      runtime,
      instantDeathFilter.kept,
      panelReport.panelHandles,
      options
    )
  )
  console.log(`Annotated ${annotated.length} candidates`)

  const dedupeReport = dedupeCandidates(annotated)
  const deduped = dedupeReport.finalCandidates
  console.log(`Deduped to ${deduped.length} candidates`)

  const finalBank = trimFinalBank(deduped, options.finalCount)
  console.log(`Trimmed final bank to ${finalBank.length} scenarios`)

  printPanelPerformanceSummary(annotated, panelReport)
  printDedupeSummary(annotated, dedupeReport, finalBank)
  printFinalBankSummary(finalBank)

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
    counts
  )

  writeFileSync(options.output, JSON.stringify(scenarioBank, null, 2))
  console.log(
    `\nWritten ${scenarioBank.length} scenarios to: ${options.output}`
  )

  if (options.report != null) {
    writeFileSync(options.report, JSON.stringify(reportDocument, null, 2))
    console.log(`Written detailed report to: ${options.report}`)
  }

  console.log('')
}

export async function runGenerateScenariosCommand(args: string[] = []) {
  await runGenerateScenarios(args)
  return 0
}
