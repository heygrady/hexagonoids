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

function sourceFitnessValue(source: SourceGenome): number {
  return typeof source.measuredFitness === 'number' ? source.measuredFitness : 0
}

function normalizeSourceFitness(
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

function signatureDistance(a: number[], b: number[]): number {
  const total = Math.max(a.length, b.length)
  if (total === 0) return 0

  let mismatches = 0
  for (let i = 0; i < total; i++) {
    if ((a[i] ?? 0) !== (b[i] ?? 0)) mismatches++
  }
  return mismatches / total
}

export async function selectReviewPanel(
  runtime: ScenarioRuntime,
  sources: SourceGenome[],
  scoutCandidates: ScenarioCandidate[],
  options: ScenarioOptions
): Promise<PanelReport> {
  const sortedSources = [...sources].sort((a, b) => {
    const diff = sourceFitnessValue(b) - sourceFitnessValue(a)
    if (diff !== 0) return diff
    if (a.kind !== b.kind) return a.kind < b.kind ? -1 : 1
    return a.id < b.id ? -1 : 1
  })

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

  const fitnessNormalizer = normalizeSourceFitness(sortedSources)
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
        options.evalTicks
      )
      return result.died ? 1 : 0
    })
    signatures.set(handle.id, signature)
  }

  const selectedHandles: AgentHandle[] = []
  const selectedLabs = new Set<string>()
  const agentScores: PanelAgentScore[] = []

  const firstHandle = allHandles[0]
  if (firstHandle == null) {
    return {
      panelHandles: [],
      scoutCandidates,
      selectionMode: 'top-fitness-fallback',
      agentScores: [],
    }
  }

  selectedHandles.push(firstHandle)
  selectedLabs.add(firstHandle.source.labId)
  agentScores.push({
    sourceId: firstHandle.source.id,
    competence: fitnessNormalizer(firstHandle.source),
    diversity: 1,
    lineageBonus: 1,
    selectionScore: 1,
    selected: true,
  })

  while (
    selectedHandles.length < options.panelMax &&
    selectedHandles.length < allHandles.length
  ) {
    let bestCandidate: {
      handle: AgentHandle
      competence: number
      minDistance: number
      lineageBonus: number
      selectionScore: number
    } | null = null
    let bestScore = -Infinity

    for (const handle of allHandles) {
      if (selectedHandles.includes(handle)) continue

      const signature = signatures.get(handle.id) ?? []
      let minDistance = 1
      for (const selected of selectedHandles) {
        const selectedSignature = signatures.get(selected.id) ?? []
        minDistance = Math.min(
          minDistance,
          signatureDistance(signature, selectedSignature)
        )
      }

      const competence = fitnessNormalizer(handle.source)
      const lineageBonus = selectedLabs.has(handle.source.labId) ? 0 : 1
      const selectionScore =
        minDistance * 0.7 + competence * 0.2 + lineageBonus * 0.1

      if (selectionScore > bestScore) {
        bestScore = selectionScore
        bestCandidate = {
          handle,
          competence,
          minDistance,
          lineageBonus,
          selectionScore,
        }
      }
    }

    if (bestCandidate == null) break

    selectedHandles.push(bestCandidate.handle)
    selectedLabs.add(bestCandidate.handle.source.labId)
    agentScores.push({
      sourceId: bestCandidate.handle.source.id,
      competence: bestCandidate.competence,
      diversity: bestCandidate.minDistance,
      lineageBonus: bestCandidate.lineageBonus,
      selectionScore: bestCandidate.selectionScore,
      selected: true,
    })
  }

  const selectedIds = new Set(selectedHandles.map((handle) => handle.id))
  for (const handle of allHandles) {
    if (!selectedIds.has(handle.id)) {
      agentScores.push({
        sourceId: handle.source.id,
        competence: fitnessNormalizer(handle.source),
        selected: false,
      })
    }
  }

  return {
    panelHandles: selectedHandles,
    scoutCandidates,
    selectionMode: 'diverse-greedy',
    agentScores,
  }
}
