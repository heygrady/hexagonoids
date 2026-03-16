import { Handler } from '@neat-evolution/worker-actions'

import {
  evaluateScenarioWithAgent,
  isAnnotationFailure,
  simulateRandomTrials,
} from './annotation.js'
import { createAgentHandle, loadScenarioRuntime } from './runtime.js'
import type { AgentHandle, ScenarioRuntime } from './types.js'
import {
  type AnnotateBatchResult,
  annotateBatch,
  type CollectCandidatesPayload,
  type CollectCandidatesResult,
  collectCandidates,
  type FilterInstantDeathResult,
  filterInstantDeath,
  init,
  type ScoutAgentResult,
  scoutAgent,
  terminate,
} from './workerScenarioActions.js'

interface ThreadContext {
  runtime: ScenarioRuntime | null
  handleCache: Map<string, AgentHandle>
}

const threadContext: ThreadContext = {
  runtime: null,
  handleCache: new Map(),
}

async function getOrCreateHandle(
  source: CollectCandidatesPayload['source']
): Promise<AgentHandle> {
  const runtime = threadContext.runtime
  if (runtime == null) {
    throw new Error('Worker not initialized — call INIT first')
  }

  const cached = threadContext.handleCache.get(source.id)
  if (cached != null) return cached

  const handle = await createAgentHandle(runtime, source)
  threadContext.handleCache.set(source.id, handle)
  return handle
}

const handler = new Handler()

handler.register(init, async (_payload, _context) => {
  threadContext.runtime = await loadScenarioRuntime()
  return null
})

handler.register(
  collectCandidates,
  async (payload, _context): Promise<CollectCandidatesResult> => {
    const runtime = threadContext.runtime
    if (runtime == null) throw new Error('Worker not initialized')

    const {
      source,
      countPerSource,
      seed,
      rewind,
      maxGames,
      captureTypes,
      killRatio,
    } = payload
    const handle = await getOrCreateHandle(source)

    const scenarios = runtime.generateScenarios({
      count: countPerSource,
      baseSeed: `${seed}:${source.id}`,
      rewindFrames: rewind,
      maxGames,
      agent: handle.agent,
      captureTypes,
      killRatio,
    })

    // Return only the snapshots — main thread wraps them as candidates
    return { scenarios }
  }
)

handler.register(
  filterInstantDeath,
  async (payload, _context): Promise<FilterInstantDeathResult> => {
    const runtime = threadContext.runtime
    if (runtime == null) throw new Error('Worker not initialized')

    const { scenarioRefs, seed, instantDeathTicks, instantDeathTrials } =
      payload
    const kept: FilterInstantDeathResult['kept'] = []
    const removed: FilterInstantDeathResult['removed'] = []

    for (const ref of scenarioRefs) {
      const trials = simulateRandomTrials(
        runtime,
        ref.scenario,
        instantDeathTicks,
        instantDeathTrials,
        `${seed}:${ref.id}:instant`
      )
      const survivable = trials.some((trial) => !trial.died)

      if (survivable) {
        kept.push({
          id: ref.id,
          instantDeathTicks,
          instantDeathTrials: trials.length,
        })
      } else {
        removed.push({
          id: ref.id,
          instantDeathTicks,
          instantDeathTrials: trials.length,
        })
      }
    }

    return { kept, removed }
  }
)

handler.register(
  scoutAgent,
  async (payload, _context): Promise<ScoutAgentResult> => {
    const runtime = threadContext.runtime
    if (runtime == null) throw new Error('Worker not initialized')

    const { source, scoutScenarios, evalTicks } = payload
    const handle = await getOrCreateHandle(source)

    const envConfig = runtime.DEFAULT_HEXAGONOIDS_ENVIRONMENT_CONFIG
      ?.simulation ?? {
      dtMs: 33,
    }
    const simConfig = { maxTicks: evalTicks, dtMs: envConfig.dtMs ?? 33 }

    const signature = scoutScenarios.map((scenario) => {
      const metrics = runtime.simulateScenario(
        handle.agent,
        scenario,
        simConfig,
        `${handle.id}:${scenario.wave}:${scenario.difficulty}`
      )
      return metrics.deaths > 0 ? 1 : 0
    })

    return { id: source.id, signature }
  }
)

handler.register(
  annotateBatch,
  async (payload, _context): Promise<AnnotateBatchResult> => {
    const runtime = threadContext.runtime
    if (runtime == null) throw new Error('Worker not initialized')

    const {
      scenarioRefs,
      panelSources,
      evalTicks,
      randomBaselineTrials,
      seed,
    } = payload

    // Build all panel handles (cached across calls)
    const panelHandles: AgentHandle[] = []
    for (const source of panelSources) {
      panelHandles.push(await getOrCreateHandle(source))
    }

    const annotations: AnnotateBatchResult['annotations'] = []
    for (const ref of scenarioRefs) {
      const captureType = ref.scenario.captureType
      const evaluations = panelHandles.map((handle) =>
        evaluateScenarioWithAgent(runtime, ref.scenario, handle, evalTicks)
      )

      const failures = evaluations.filter((entry) =>
        isAnnotationFailure(entry, captureType)
      ).length
      const failureRate =
        evaluations.length > 0 ? failures / evaluations.length : 0
      const avgFitness =
        evaluations.length > 0
          ? evaluations.reduce((sum, entry) => sum + entry.fitness, 0) /
            evaluations.length
          : 0
      const randomTrials = simulateRandomTrials(
        runtime,
        ref.scenario,
        evalTicks,
        randomBaselineTrials,
        `${seed}:${ref.id}:baseline`
      )
      const randomFailures = randomTrials.filter((trial) =>
        captureType === 'kill' ? trial.rocksDestroyed === 0 : trial.died
      ).length
      const randomSurvivals = randomTrials.length - randomFailures
      const likelyUnrecoverable =
        failures === evaluations.length && randomSurvivals === 0

      annotations.push({
        id: ref.id,
        annotations: {
          evaluations,
          panelSize: evaluations.length,
          failures,
          failureRate,
          averageFitness: avgFitness,
          randomBaseline: {
            trials: randomTrials.length,
            survivals: randomSurvivals,
            allDied: randomSurvivals === 0,
          },
          likelyUnrecoverable,
        },
      })
    }

    return { annotations }
  }
)

handler.register(terminate, async (_payload, _context) => {
  threadContext.handleCache.clear()
  threadContext.runtime = null
  return null
})

handler.ready()
