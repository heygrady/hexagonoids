import {
  type CompactScenarioBankDocument,
  encodeScenarioBankDocument,
} from '@heygrady/hexagonoids-environment'

import { SUPPORTED_IO } from './options.js'
import type {
  InstantDeathFilterReport,
  PanelReport,
  ScenarioCandidate,
  ScenarioOptions,
  ScenarioRunCounts,
  SourceReport,
} from './types.js'

export function makeOutputDocument(
  options: ScenarioOptions,
  sourceReport: SourceReport,
  panelReport: PanelReport,
  instantDeathFilter: InstantDeathFilterReport,
  finalBank: ScenarioCandidate[],
  counts: ScenarioRunCounts
) {
  return {
    generatedAt: new Date().toISOString(),
    expectedIo: SUPPORTED_IO,
    options: {
      maxLabs: options.maxLabs,
      heroCount: options.heroCount,
      countPerSource: options.countPerSource,
      panelMax: options.panelMax,
      panelScoutCount: options.panelScoutCount,
      rewind: options.rewind,
      maxGames: options.maxGames,
      evalTicks: options.evalTicks,
      instantDeathTrials: options.instantDeathTrials,
      randomBaselineTrials: options.randomBaselineTrials,
      finalCount: options.finalCount,
      killRatio: options.killRatio,
      seed: options.seed,
      existing: options.existing,
      mergeExisting: options.mergeExisting,
    },
    counts,
    filters: {
      instantDeath: {
        ticks: instantDeathFilter.instantDeathTicks,
        trials: options.instantDeathTrials,
        removed: instantDeathFilter.removed.length,
      },
    },
    reviewPanel: {
      selectionMode: panelReport.selectionMode,
      scoutCandidates: panelReport.scoutCandidates.length,
      sources: panelReport.panelHandles.map((handle) => ({
        id: handle.source.id,
        labId: handle.source.labId,
        kind: handle.source.kind,
        method: handle.source.method,
        encodingPreset: handle.source.encodingPreset,
        generation: handle.source.generation,
        measuredFitness: handle.source.measuredFitness,
      })),
      agentScores: panelReport.agentScores,
    },
    sources: sourceReport.sources.map((source) => ({
      id: source.id,
      labId: source.labId,
      kind: source.kind,
      genomePath: source.genomePath,
      method: source.method,
      encodingPreset: source.encodingPreset,
      generation: source.generation,
      measuredFitness: source.measuredFitness,
    })),
    filteredOutCandidates: {
      instantDeath: instantDeathFilter.removed,
    },
    rejectedSources: sourceReport.rejected,
    scenarios: finalBank.map((entry) => ({
      id: entry.id,
      source: {
        id: entry.source.id,
        labId: entry.source.labId,
        kind: entry.source.kind,
        method: entry.source.method,
        encodingPreset: entry.source.encodingPreset,
        generation: entry.source.generation,
        measuredFitness: entry.source.measuredFitness,
      },
      summary: entry.summary,
      cluster: entry.cluster,
      interestingness: entry.interestingness,
      annotations: entry.annotations,
      scenario: entry.scenario,
    })),
  }
}

export function makeScenarioBank(
  finalBank: ScenarioCandidate[]
): CompactScenarioBankDocument {
  const snapshots = finalBank.map((entry) => ({
    ...entry.scenario,
    ...(entry.cluster?.behaviorSignature != null && {
      failureSignature: entry.cluster.behaviorSignature,
    }),
  }))
  return encodeScenarioBankDocument(snapshots)
}
