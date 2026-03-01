import type {
  CandidateSummary,
  ScenarioCandidate,
  ScenarioSnapshot,
  SourceGenome,
} from './types.js'

export function makeCandidateSummary(
  scenario: Partial<ScenarioSnapshot> | null | undefined
): CandidateSummary {
  return {
    wave: Number(scenario?.wave) || 0,
    difficulty: Number(scenario?.difficulty) || 0,
    rocks: Array.isArray(scenario?.rocks) ? scenario.rocks.length : 0,
  }
}

export function makeScenarioCandidate(
  id: string,
  source: SourceGenome,
  scenario: ScenarioSnapshot
): ScenarioCandidate {
  return {
    id,
    source,
    scenario,
    summary: makeCandidateSummary(scenario),
  }
}
