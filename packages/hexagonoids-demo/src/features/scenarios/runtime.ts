import { existsSync, readFileSync } from 'node:fs'
import { basename } from 'node:path'
import { gunzipSync } from 'node:zlib'

import { decodeScenarioBankDocument } from '@heygrady/hexagonoids-environment'

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
    createNeatAgent: env.createNeatAgent,
    neatAgent: env.neatAgent,
    randomAgent: env.randomAgent,
    simulateScenario: env.simulateScenario,
    weightedFitnessSum: env.weightedFitnessSum,
    computePossibleDeaths: env.computePossibleDeaths,
    DEFAULT_HEXAGONOIDS_ENVIRONMENT_CONFIG:
      env.DEFAULT_HEXAGONOIDS_ENVIRONMENT_CONFIG,
  } as unknown as ScenarioRuntime
}

export async function createAgentHandle(
  runtime: ScenarioRuntime,
  source: SourceGenome
): Promise<AgentHandle> {
  if (source.method == null) {
    throw new Error(`Source "${source.id}" is missing a training method`)
  }
  const manager = runtime.createNodeEvolutionManager({ method: source.method })
  const serialized = runtime.loadGenome(source.genomePath)
  const organism = manager.createOrganism(source.method, serialized)
  const executor = manager.organismToExecutor(organism)

  return {
    id: source.id,
    label: `${source.kind}:${source.labId}:${basename(source.genomePath)}`,
    source,
    agent: runtime.createNeatAgent(),
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

function readScenarioBankFile(pathname: string): unknown {
  const text = readFileSync(pathname, 'utf8')
  if (pathname.endsWith('.js')) {
    const match = text.match(/export default "([^"]+)"/)
    if (match?.[1]) {
      const buf = Buffer.from(match[1], 'base64')
      const bytes = new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength)
      return JSON.parse(new TextDecoder().decode(gunzipSync(bytes)))
    }
  }
  return JSON.parse(text)
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

  const scenarios = decodeScenarioBankDocument(
    readScenarioBankFile(options.existing)
  )

  const source: SourceGenome = {
    id: `existing-bank:${basename(options.existing)}`,
    labId: 'existing-bank',
    kind: 'existing-bank',
    genomePath: options.existing,
    method: null,
    generation: null,
    measuredFitness: null,
    io: null,
  }

  const candidates = scenarios.map((scenario, index) =>
    makeScenarioCandidate(`${source.id}:s${index}`, source, scenario)
  )

  return { candidates, source }
}
