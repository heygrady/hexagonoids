import { createAgentHandle } from './runtime.js'
import type {
  AgentHandle,
  PanelAgentScore,
  PanelReport,
  ScenarioCandidate,
  ScenarioOptions,
  ScenarioRuntime,
  SourceGenome,
} from './types.js'

export function sourceFitnessValue(source: SourceGenome): number {
  return typeof source.measuredFitness === 'number' ? source.measuredFitness : 0
}

export function normalizeSourceFitness(
  sources: SourceGenome[]
): (source: SourceGenome) => number {
  const values = sources.map((source) => sourceFitnessValue(source))
  const minFitness = values.length > 0 ? Math.min(...values) : 0
  const maxFitness = values.length > 0 ? Math.max(...values) : 0

  return (source: SourceGenome) => {
    const value = sourceFitnessValue(source)
    if (maxFitness <= minFitness) return 1
    return (value - minFitness) / (maxFitness - minFitness)
  }
}

export function selectScoutCandidates(
  candidates: ScenarioCandidate[],
  scoutCount: number
): ScenarioCandidate[] {
  const sorted = [...candidates].sort((a, b) => {
    if (a.summary.wave !== b.summary.wave)
      return a.summary.wave - b.summary.wave
    if (a.summary.rocks !== b.summary.rocks)
      return a.summary.rocks - b.summary.rocks
    return a.summary.difficulty - b.summary.difficulty
  })

  const count = Math.min(sorted.length, scoutCount)
  if (count <= 0) return []

  const indices = new Set([0, sorted.length - 1])
  if (count > 1) {
    const steps = count - 1
    for (let i = 0; i <= steps; i++) {
      indices.add(Math.round((i * (sorted.length - 1)) / steps))
    }
  }

  return [...indices]
    .sort((a, b) => a - b)
    .slice(0, count)
    .map((index) => sorted[index])
    .filter((candidate): candidate is ScenarioCandidate => candidate != null)
}

function evaluateScenarioWithAgent(
  runtime: ScenarioRuntime,
  scenario: ScenarioCandidate['scenario'],
  handle: AgentHandle,
  evalTicks: number
): { died: boolean } {
  const envConfig = runtime.DEFAULT_HEXAGONOIDS_ENVIRONMENT_CONFIG
    ?.simulation ?? { dtMs: 33 }
  const simConfig = { maxTicks: evalTicks, dtMs: envConfig.dtMs ?? 33 }
  const metrics = runtime.simulateScenario(
    handle.agent,
    scenario,
    simConfig,
    `${handle.id}:${scenario.wave}:${scenario.difficulty}`,
    handle.executor
  )

  return {
    died: metrics.deaths > 0,
  }
}

export function signatureDistance(a: number[], b: number[]): number {
  const total = Math.max(a.length, b.length)
  if (total === 0) return 0

  let mismatches = 0
  for (let i = 0; i < total; i++) {
    if ((a[i] ?? 0) !== (b[i] ?? 0)) mismatches++
  }
  return mismatches / total
}

/**
 * Compute scout signatures for all handles against scout candidates.
 * Used when running sequentially on the main thread.
 */
export function computeScoutSignatures(
  runtime: ScenarioRuntime,
  allHandles: AgentHandle[],
  scoutCandidates: ScenarioCandidate[],
  evalTicks: number
): Map<string, number[]> {
  const signatures = new Map<string, number[]>()

  for (const [i, handle] of allHandles.entries()) {
    if ((i + 1) % 8 === 0 || i === 0) {
      console.log(
        `Scouting panel behavior ${i + 1}/${allHandles.length} against ${scoutCandidates.length} scenarios`
      )
    }

    const signature = scoutCandidates.map((candidate) => {
      const result = evaluateScenarioWithAgent(
        runtime,
        candidate.scenario,
        handle,
        evalTicks
      )
      return result.died ? 1 : 0
    })
    signatures.set(handle.id, signature)
  }

  return signatures
}

/**
 * Sort sources by fitness (descending) for panel selection.
 */
export function sortSourcesByFitness(sources: SourceGenome[]): SourceGenome[] {
  return [...sources].sort((a, b) => {
    const diff = sourceFitnessValue(b) - sourceFitnessValue(a)
    if (diff !== 0) return diff
    if (a.kind !== b.kind) return a.kind < b.kind ? -1 : 1
    return a.id < b.id ? -1 : 1
  })
}

/**
 * Greedy diversity selection using pre-computed signatures.
 * Separated from signature computation so workers can provide signatures.
 */
export function selectPanelFromSignatures(
  sources: SourceGenome[],
  signatures: Map<string, number[]>,
  options: ScenarioOptions
): { selectedSourceIds: string[]; agentScores: PanelAgentScore[] } {
  const sortedSources = sortSourcesByFitness(sources)
  const fitnessNormalizer = normalizeSourceFitness(sortedSources)

  const selectedIds: string[] = []
  const selectedLabs = new Set<string>()
  const agentScores: PanelAgentScore[] = []

  const firstSource = sortedSources[0]
  if (firstSource == null) {
    return { selectedSourceIds: [], agentScores: [] }
  }

  selectedIds.push(firstSource.id)
  selectedLabs.add(firstSource.labId)
  agentScores.push({
    sourceId: firstSource.id,
    competence: fitnessNormalizer(firstSource),
    diversity: 1,
    lineageBonus: 1,
    selectionScore: 1,
    selected: true,
  })

  while (
    selectedIds.length < options.panelMax &&
    selectedIds.length < sortedSources.length
  ) {
    let bestCandidate: {
      source: SourceGenome
      competence: number
      minDistance: number
      lineageBonus: number
      selectionScore: number
    } | null = null
    let bestScore = -Infinity

    for (const source of sortedSources) {
      if (selectedIds.includes(source.id)) continue

      const signature = signatures.get(source.id) ?? []
      let minDistance = 1
      for (const selectedId of selectedIds) {
        const selectedSignature = signatures.get(selectedId) ?? []
        minDistance = Math.min(
          minDistance,
          signatureDistance(signature, selectedSignature)
        )
      }

      const competence = fitnessNormalizer(source)
      const lineageBonus = selectedLabs.has(source.labId) ? 0 : 1
      const selectionScore =
        minDistance * 0.7 + competence * 0.2 + lineageBonus * 0.1

      if (selectionScore > bestScore) {
        bestScore = selectionScore
        bestCandidate = {
          source,
          competence,
          minDistance,
          lineageBonus,
          selectionScore,
        }
      }
    }

    if (bestCandidate == null) break

    selectedIds.push(bestCandidate.source.id)
    selectedLabs.add(bestCandidate.source.labId)
    agentScores.push({
      sourceId: bestCandidate.source.id,
      competence: bestCandidate.competence,
      diversity: bestCandidate.minDistance,
      lineageBonus: bestCandidate.lineageBonus,
      selectionScore: bestCandidate.selectionScore,
      selected: true,
    })
  }

  for (const source of sortedSources) {
    if (!selectedIds.includes(source.id)) {
      agentScores.push({
        sourceId: source.id,
        competence: fitnessNormalizer(source),
        selected: false,
      })
    }
  }

  return { selectedSourceIds: selectedIds, agentScores }
}

export async function selectReviewPanel(
  runtime: ScenarioRuntime,
  sources: SourceGenome[],
  scoutCandidates: ScenarioCandidate[],
  options: ScenarioOptions
): Promise<PanelReport> {
  const sortedSources = sortSourcesByFitness(sources)

  const allHandles: AgentHandle[] = []
  for (const source of sortedSources) {
    allHandles.push(await createAgentHandle(runtime, source))
  }

  if (allHandles.length <= options.panelMax) {
    return {
      panelHandles: allHandles,
      scoutCandidates,
      selectionMode: 'all-sources',
      agentScores: allHandles.map((handle) => ({
        sourceId: handle.source.id,
        competence: 1,
        selected: true,
      })),
    }
  }

  if (scoutCandidates.length === 0) {
    return {
      panelHandles: allHandles.slice(0, options.panelMax),
      scoutCandidates,
      selectionMode: 'top-fitness-fallback',
      agentScores: allHandles.map((handle, index) => ({
        sourceId: handle.source.id,
        competence: index < options.panelMax ? 1 : 0,
        selected: index < options.panelMax,
      })),
    }
  }

  // Compute signatures sequentially on main thread
  const signatures = computeScoutSignatures(
    runtime,
    allHandles,
    scoutCandidates,
    options.evalTicks
  )

  // Run greedy selection using source IDs as keys
  const sourceSignatures = new Map<string, number[]>()
  for (const handle of allHandles) {
    const sig = signatures.get(handle.id)
    if (sig != null) {
      sourceSignatures.set(handle.source.id, sig)
    }
  }

  const { selectedSourceIds, agentScores } = selectPanelFromSignatures(
    sortedSources,
    sourceSignatures,
    options
  )

  const panelHandles = allHandles.filter((h) =>
    selectedSourceIds.includes(h.source.id)
  )
  // Preserve selection order
  panelHandles.sort(
    (a, b) =>
      selectedSourceIds.indexOf(a.source.id) -
      selectedSourceIds.indexOf(b.source.id)
  )

  return {
    panelHandles,
    scoutCandidates,
    selectionMode: 'diverse-greedy',
    agentScores,
  }
}

/**
 * Build a PanelReport from pre-computed signatures (used by worker pool path).
 */
export async function selectReviewPanelFromSignatures(
  runtime: ScenarioRuntime,
  sources: SourceGenome[],
  signatures: Map<string, number[]>,
  scoutCandidates: ScenarioCandidate[],
  options: ScenarioOptions
): Promise<PanelReport> {
  const sortedSources = sortSourcesByFitness(sources)

  if (sortedSources.length <= options.panelMax) {
    const allHandles: AgentHandle[] = []
    for (const source of sortedSources) {
      allHandles.push(await createAgentHandle(runtime, source))
    }
    return {
      panelHandles: allHandles,
      scoutCandidates,
      selectionMode: 'all-sources',
      agentScores: allHandles.map((handle) => ({
        sourceId: handle.source.id,
        competence: 1,
        selected: true,
      })),
    }
  }

  if (scoutCandidates.length === 0) {
    const allHandles: AgentHandle[] = []
    for (const source of sortedSources) {
      allHandles.push(await createAgentHandle(runtime, source))
    }
    return {
      panelHandles: allHandles.slice(0, options.panelMax),
      scoutCandidates,
      selectionMode: 'top-fitness-fallback',
      agentScores: allHandles.map((handle, index) => ({
        sourceId: handle.source.id,
        competence: index < options.panelMax ? 1 : 0,
        selected: index < options.panelMax,
      })),
    }
  }

  const { selectedSourceIds, agentScores } = selectPanelFromSignatures(
    sortedSources,
    signatures,
    options
  )

  const panelHandles: AgentHandle[] = []
  for (const sourceId of selectedSourceIds) {
    const source = sortedSources.find((s) => s.id === sourceId)
    if (source != null) {
      panelHandles.push(await createAgentHandle(runtime, source))
    }
  }

  return {
    panelHandles,
    scoutCandidates,
    selectionMode: 'diverse-greedy',
    agentScores,
  }
}
