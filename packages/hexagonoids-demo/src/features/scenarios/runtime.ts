import { existsSync, readFileSync } from 'node:fs'
import { basename } from 'node:path'

import { makeScenarioCandidate } from './candidates.js'
import type {
  AgentHandle,
  ScenarioCandidate,
  ScenarioOptions,
  ScenarioRuntime,
  SourceGenome,
} from './types.js'

export async function loadScenarioRuntime(): Promise<ScenarioRuntime> {
  const demoNode = await import('@heygrady/hexagonoids-demo/node')
  const envNode = await import('@heygrady/hexagonoids-environment/node')
  const env = await import('@heygrady/hexagonoids-environment')

  return {
    createNodeEvolutionManager: demoNode.createNodeEvolutionManager,
    loadGenome: demoNode.loadGenome,
    generateScenarios: envNode.generateScenarios,
    neatAgent: env.neatAgent,
    randomAgent: env.randomAgent,
    simulateScenario: env.simulateScenario,
    weightedFitnessSum: env.weightedFitnessSum,
    scenarioMaximums: env.scenarioMaximums,
    scenarioPossibleDeaths: env.scenarioPossibleDeaths,
    DEFAULT_HEXAGONOIDS_ENVIRONMENT_CONFIG:
      env.DEFAULT_HEXAGONOIDS_ENVIRONMENT_CONFIG,
  } as unknown as ScenarioRuntime
}

export async function createAgentHandle(
  runtime: ScenarioRuntime,
  source: SourceGenome
): Promise<AgentHandle> {
  const manager = runtime.createNodeEvolutionManager({ method: 'HyperNEAT' })
  const serialized = runtime.loadGenome(source.genomePath)
  const organism = manager.createOrganism('HyperNEAT', serialized)
  const executor = manager.organismToExecutor(organism)

  return {
    id: source.id,
    label: `${source.kind}:${source.labId}:${basename(source.genomePath)}`,
    source,
    agent: runtime.neatAgent,
    executor,
  }
}

export async function collectCandidateScenarios(
  runtime: ScenarioRuntime,
  sources: SourceGenome[],
  options: ScenarioOptions
): Promise<ScenarioCandidate[]> {
  const candidates: ScenarioCandidate[] = []

  for (const [i, source] of sources.entries()) {
    console.log(
      `Collecting candidates from ${source.id} (${i + 1}/${sources.length})`
    )

    const handle = await createAgentHandle(runtime, source)
    const scenarios = runtime.generateScenarios({
      count: options.countPerSource,
      baseSeed: `${options.seed}:${source.id}`,
      rewindFrames: options.rewind,
      maxGames: options.maxGames,
      agent: handle.agent,
      executor: handle.executor,
    })

    for (const [index, scenario] of scenarios.entries()) {
      candidates.push(
        makeScenarioCandidate(`${source.id}:s${index}`, source, scenario)
      )
    }
  }

  return candidates
}

function readJson(pathname: string): unknown {
  return JSON.parse(readFileSync(pathname, 'utf8'))
}

export function loadExistingScenarioCandidates(options: ScenarioOptions): {
  candidates: ScenarioCandidate[]
  source: SourceGenome | null
} {
  if (!options.mergeExisting) {
    return { candidates: [], source: null }
  }

  if (!existsSync(options.existing)) {
    return { candidates: [], source: null }
  }

  const scenarios = readJson(options.existing)
  if (!Array.isArray(scenarios)) {
    throw new Error(
      `Existing scenario bank is not an array: ${options.existing}`
    )
  }

  const source: SourceGenome = {
    id: `existing-bank:${basename(options.existing)}`,
    labId: 'existing-bank',
    kind: 'existing-bank',
    genomePath: options.existing,
    generation: null,
    measuredFitness: null,
    io: null,
  }

  const candidates = scenarios.map((scenario, index) =>
    makeScenarioCandidate(
      `${source.id}:s${index}`,
      source,
      scenario as ScenarioCandidate['scenario']
    )
  )

  return { candidates, source }
}
