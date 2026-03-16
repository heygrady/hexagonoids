import type {
  AgentHandle,
  CandidateEvaluation,
  InstantDeathFilterReport,
  ScenarioCandidate,
  ScenarioOptions,
  ScenarioRuntime,
} from './types.js'

/** Determine failure based on captureType: kills fail when no rocks destroyed, deaths fail when agent dies. */
export function isAnnotationFailure(
  evaluation: CandidateEvaluation,
  captureType: string | undefined
): boolean {
  return captureType === 'kill'
    ? evaluation.rocksDestroyed === 0
    : evaluation.died
}

export function simulateRandomTrials(
  runtime: ScenarioRuntime,
  scenario: ScenarioCandidate['scenario'],
  maxTicks: number,
  trials: number,
  seedBase: string
): Array<{ died: boolean; deaths: number; rocksDestroyed: number }> {
  const dtMs =
    runtime.DEFAULT_HEXAGONOIDS_ENVIRONMENT_CONFIG?.simulation?.dtMs ?? 33
  const simConfig = { maxTicks, dtMs }
  const outcomes = []

  for (let i = 0; i < trials; i++) {
    const metrics = runtime.simulateScenario(
      runtime.randomAgent,
      scenario,
      simConfig,
      `${seedBase}:random:${i}`
    )
    outcomes.push({
      died: metrics.deaths > 0,
      deaths: metrics.deaths,
      rocksDestroyed: metrics.rocksDestroyed,
    })
  }

  return outcomes
}

export function filterInstantDeathCandidates(
  runtime: ScenarioRuntime,
  candidates: ScenarioCandidate[],
  options: ScenarioOptions
): InstantDeathFilterReport {
  const kept: ScenarioCandidate[] = []
  const removed: InstantDeathFilterReport['removed'] = []
  const instantDeathTicks = Math.max(
    options.rewind + 30,
    Math.ceil(options.rewind * 1.5)
  )

  for (const candidate of candidates) {
    // Kill candidates skip instant-death filter
    if (candidate.scenario.captureType === 'kill') {
      kept.push(candidate)
      continue
    }

    const trials = simulateRandomTrials(
      runtime,
      candidate.scenario,
      instantDeathTicks,
      options.instantDeathTrials,
      `${options.seed}:${candidate.id}:instant`
    )
    const survivable = trials.some((trial) => !trial.died)

    if (survivable) {
      kept.push({
        ...candidate,
        filters: {
          instantDeathTicks,
          instantDeathTrials: trials.length,
          instantDeathAllDied: false,
        },
      })
    } else {
      removed.push({
        id: candidate.id,
        sourceId: candidate.source.id,
        instantDeathTicks,
        instantDeathTrials: trials.length,
      })
    }
  }

  return { kept, removed, instantDeathTicks }
}

export function evaluateScenarioWithAgent(
  runtime: ScenarioRuntime,
  scenario: ScenarioCandidate['scenario'],
  handle: AgentHandle,
  evalTicks: number
): CandidateEvaluation {
  const envConfig = runtime.DEFAULT_HEXAGONOIDS_ENVIRONMENT_CONFIG
    ?.simulation ?? { dtMs: 33 }
  const simConfig = { maxTicks: evalTicks, dtMs: envConfig.dtMs ?? 33 }
  const metrics = runtime.simulateScenario(
    handle.agent,
    scenario,
    simConfig,
    `${handle.id}:${scenario.wave}:${scenario.difficulty}`
  )

  const context = {
    possibleDeaths: runtime.computePossibleDeaths(
      metrics.elapsedTicks,
      simConfig.dtMs
    ),
    dtMs: simConfig.dtMs,
  }

  const config = runtime.DEFAULT_HEXAGONOIDS_ENVIRONMENT_CONFIG
  const fitness = runtime.weightedFitnessSum(
    metrics,
    config.fitnessWeights,
    config.gateConfig,
    context
  )

  return {
    agentId: handle.id,
    died: metrics.deaths > 0,
    deaths: metrics.deaths,
    rocksDestroyed: metrics.rocksDestroyed,
    shotsFired: metrics.shotsFired,
    shotsHit: metrics.shotsHit,
    fitness,
  }
}

export async function annotateCandidates(
  runtime: ScenarioRuntime,
  candidates: ScenarioCandidate[],
  panelHandles: AgentHandle[],
  options: ScenarioOptions
): Promise<ScenarioCandidate[]> {
  const annotated: ScenarioCandidate[] = []
  for (const [i, candidate] of candidates.entries()) {
    if ((i + 1) % 25 === 0 || i === 0) {
      console.log(`Annotating ${i + 1}/${candidates.length}`)
    }

    const captureType = candidate.scenario.captureType
    const evaluations = panelHandles.map((handle) =>
      evaluateScenarioWithAgent(
        runtime,
        candidate.scenario,
        handle,
        options.evalTicks
      )
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
    const randomBaselineTrials = simulateRandomTrials(
      runtime,
      candidate.scenario,
      options.evalTicks,
      options.randomBaselineTrials,
      `${options.seed}:${candidate.id}:baseline`
    )
    const randomFailures = randomBaselineTrials.filter((trial) =>
      captureType === 'kill' ? trial.rocksDestroyed === 0 : trial.died
    ).length
    const randomSurvivals = randomBaselineTrials.length - randomFailures
    const likelyUnrecoverable =
      failures === evaluations.length && randomSurvivals === 0

    annotated.push({
      ...candidate,
      annotations: {
        evaluations,
        panelSize: evaluations.length,
        failures,
        failureRate,
        averageFitness: avgFitness,
        randomBaseline: {
          trials: randomBaselineTrials.length,
          survivals: randomSurvivals,
          allDied: randomSurvivals === 0,
        },
        likelyUnrecoverable,
      },
    })
  }

  return annotated
}
