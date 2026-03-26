import { Vector3 } from '@babylonjs/core/Maths/math.vector'
import { TransformNode } from '@babylonjs/core/Meshes/transformNode'
import {
  SUPPORTED_ALGORITHMS,
  type SupportedAlgorithm,
  type TrainOptions,
} from '@heygrady/hexagonoids-demo'
import { MAX_DELTA, restartGame } from '@heygrady/hexagonoids-engine'
import { useGameState } from '@heygrady/hexagonoids-engine/solid'
import {
  type AgentContext,
  type AgentFn,
  buildCurriculumParams,
  CURRICULUM_SCENARIO_COUNT,
  createGameAgent,
  generateCurriculumSnapshot,
  restoreSnapshot,
  type ScenarioSnapshot,
} from '@heygrady/hexagonoids-environment'
import type { Executor } from '@neat-evolution/executor'
import { createVanillaStepAgent } from '@neat-evolution/rl-core'
import { createRNG } from '@neat-evolution/utils'
import { onCleanup } from 'solid-js'
import { useScene } from '../../solid-babylon/hooks/useScene'
import { DEFAULT_PLAYER_ID, RADIUS } from '../constants'
import { useInputs } from '../engine/useInputBridge'
import { getYawPitch } from '../ship/getYawPitch'
import { moveNodeTo } from '../ship/orientation'
import type { AppMode } from '../types'
import { useAppMode } from './AppModeProvider'
import {
  OBSERVE_EVALUATION_SEEDS_PER_ORGANISM,
  OBSERVE_MAX_GENERATIONS,
  OBSERVE_SEED,
  OBSERVE_WINDOW_MS,
} from './constants'
import {
  createObserveTrainingAdapter,
  organismToExecutor,
} from './training/createObserveTrainingAdapter'
import { getObserveProfile } from './training/profiles'

/**
 * Observe-mode shell. Session 01 wires mode entry/exit and HUD ownership.
 * Training/playback runtime is implemented in later sessions.
 */
export function ObserveController() {
  const scene = useScene()
  const engine = useGameState()
  const inputs = useInputs()
  const {
    setAppMode,
    setObserveTrainingGeneration,
    setObserveTrainingElapsedSeconds,
    setObserveRunningGeneration,
    setObserveRunningFitness,
    setObserveSummary,
  } = useAppMode()

  let disposed = false
  let shouldTick = true
  let currentExecutor: Executor | null = null
  let currentGeneration: number | null = null
  let currentRunBoundaryPassed = false
  let currentRunDeadlineAt = 0
  let latestAvailable: {
    generation: number
    fitness: number
    organism: unknown
  } | null = null
  let trainingTargetGeneration = 1
  let waitingStartedAt = performance.now()
  let bestFitness = Number.NEGATIVE_INFINITY
  let bestGeneration = 0
  let trainingCompleted = false
  let generationEvents = 0
  let generationSwitches = 0
  let skippedGenerations = 0
  let totalWaitMs = 0
  let waitCount = 0
  let summaryShown = false
  let latestConsumed = false
  let replayCounter = 0

  const aiContext: AgentContext = {
    rng: createRNG(`${OBSERVE_SEED}:agent`),
    memory: {},
    spatialQueries: engine,
  }

  let observeAgent: AgentFn | null = null

  const adapter = createObserveTrainingAdapter()

  // ── Resolve config: profile defaults → URL param overrides ──
  const searchParams = new URLSearchParams(window.location.search)

  const profileName = searchParams.get('profile') ?? 'default'
  const profileOptions: Partial<TrainOptions> =
    getObserveProfile(profileName) ?? {}
  if (Object.keys(profileOptions).length > 0) {
    console.log(`[OBSERVE] profile=${profileName}`, profileOptions)
  } else if (profileName !== 'default') {
    console.log(`[OBSERVE] profile=${profileName} (not found)`)
  }

  // URL param overrides
  const urlOverrides: Partial<TrainOptions> = {}

  // Method: profile → URL override
  let observeMethod: SupportedAlgorithm = profileOptions.method ?? 'HyperNEAT'
  const requestedMethod = searchParams.get('method')
  if (
    requestedMethod != null &&
    SUPPORTED_ALGORITHMS.includes(requestedMethod as SupportedAlgorithm)
  ) {
    observeMethod = requestedMethod as SupportedAlgorithm
    urlOverrides.method = observeMethod
  } else if (requestedMethod != null) {
    console.warn(
      `[OBSERVE] Unsupported method "${requestedMethod}", using ${observeMethod}`
    )
  }

  // RL reward config URL overrides
  const parseFloatParam = (name: string): number | undefined => {
    const v = searchParams.get(name)
    if (v == null) return undefined
    const n = parseFloat(v)
    return Number.isFinite(n) ? n : undefined
  }
  const rlLR = parseFloatParam('rlLearningRate')
  if (rlLR != null) urlOverrides.rlLearningRate = rlLR
  const rlBulletAim = parseFloatParam('rlRewardBulletAim')
  if (rlBulletAim != null) urlOverrides.rlRewardBulletAim = rlBulletAim
  const rlMissDemerit = parseFloatParam('rlRewardBulletMissDemerit')
  if (rlMissDemerit != null) urlOverrides.rlRewardBulletMissDemerit = rlMissDemerit
  const rlDeath = parseFloatParam('rlRewardDeath')
  if (rlDeath != null) urlOverrides.rlRewardDeath = rlDeath
  const rlThrust = parseFloatParam('rlRewardThrust')
  if (rlThrust != null) urlOverrides.rlRewardThrust = rlThrust

  // observeAgent is set in startGeneration when a new executor arrives

  const agentMode = searchParams.get('agent') === 'best' ? 'best' : 'hero'

  // Parse playback mode with backward compat for ?scenario=true
  type PlaybackMode = 'full-game' | 'scenario' | 'curriculum'
  let playbackMode: PlaybackMode = 'full-game'
  const playbackParam = searchParams.get('playback')
  if (
    playbackParam === 'scenario' ||
    playbackParam === 'curriculum' ||
    playbackParam === 'full-game'
  ) {
    playbackMode = playbackParam
  } else if (searchParams.get('scenario') === 'true') {
    playbackMode = 'scenario'
  }

  // Parse iterations override from URL
  const iterationsParam = searchParams.get('iterations')
  const iterationsOverride =
    iterationsParam != null ? parseInt(iterationsParam, 10) : NaN
  const observeMaxGenerations =
    !Number.isNaN(iterationsOverride) && iterationsOverride > 0
      ? iterationsOverride
      : (profileOptions.iterations ?? OBSERVE_MAX_GENERATIONS)

  let playbackScenarioBank: ScenarioSnapshot[] | null = null
  if (playbackMode === 'scenario') {
    void import('@heygrady/hexagonoids-demo/data/scenarios')
      .then(({ loadScenarioBank }) => loadScenarioBank())
      .then((bank) => {
        playbackScenarioBank = bank
        console.log(
          `[OBSERVE] Loaded ${playbackScenarioBank.length} scenarios for playback`
        )
      })
      .catch(() => {
        console.warn('[OBSERVE] Failed to load scenarios for playback')
      })
  }

  // Parse curriculum index override — pin to a single scenario or start cycling from it
  const curriculumParam = searchParams.get('curriculum')
  const curriculumParsed =
    curriculumParam != null ? parseInt(curriculumParam, 10) : NaN
  const curriculumPinIndex =
    !Number.isNaN(curriculumParsed) &&
    curriculumParsed >= 0 &&
    curriculumParsed < CURRICULUM_SCENARIO_COUNT
      ? curriculumParsed
      : null
  let curriculumIndex = curriculumPinIndex ?? 0
  let curriculumTicksRemaining = 0

  // Parse RL mode from URL
  let observeRLMode: TrainOptions['rlMode'] = undefined
  const rlParam = searchParams.get('rl')
  if (rlParam === 'ppo') {
    observeRLMode = 'ppo'
  } else if (rlParam != null && rlParam !== 'none') {
    console.warn(
      `[OBSERVE] Unsupported RL mode "${rlParam}", using none`
    )
  }

  // Parse RL warmup generations from URL
  const rlWarmupParam = searchParams.get('rlWarmup')
  const rlWarmupParsed =
    rlWarmupParam != null ? parseInt(rlWarmupParam, 10) : NaN
  const observeRLWarmup =
    !Number.isNaN(rlWarmupParsed) && rlWarmupParsed > 0
      ? rlWarmupParsed
      : undefined

  console.log(
    `[OBSERVE] method=${observeMethod}, ` +
      `agent=${agentMode}, playback=${playbackMode}, maxGenerations=${observeMaxGenerations}` +
      (observeRLMode != null ? `, rl=${observeRLMode}` : '') +
      (observeRLWarmup != null ? `, rlWarmup=${observeRLWarmup}` : '')
  )

  setObserveTrainingGeneration(1)
  setObserveTrainingElapsedSeconds(0)
  setObserveRunningGeneration(null)
  setObserveRunningFitness(null)
  setObserveSummary(null)

  const startWaiting = (generationTarget: number, forceReset = false) => {
    const normalizedTarget = Math.max(1, generationTarget)
    if (
      forceReset ||
      trainingTargetGeneration !== normalizedTarget ||
      currentExecutor != null
    ) {
      trainingTargetGeneration = normalizedTarget
      waitingStartedAt = performance.now()
      setObserveTrainingElapsedSeconds(0)
    }
    setObserveTrainingGeneration(trainingTargetGeneration)
  }

  const stopRunning = () => {
    currentExecutor = null
    currentGeneration = null
    currentRunBoundaryPassed = false
    observeAgent = null
    aiContext.memory = {}
    setObserveRunningGeneration(null)
    setObserveRunningFitness(null)
  }

  const maybeShowSummary = () => {
    if (
      !trainingCompleted ||
      currentExecutor != null ||
      summaryShown ||
      engine.state.endedAt != null
    ) {
      return
    }
    summaryShown = true
    const averageWaitMs =
      waitCount > 0 ? Math.round(totalWaitMs / waitCount) : 0
    console.log(
      `[OBSERVE] completed generations=${observeMaxGenerations} bestGen=${bestGeneration} ` +
        `bestFitness=${Number.isFinite(bestFitness) ? bestFitness.toFixed(2) : '0.00'} ` +
        `events=${generationEvents} switches=${generationSwitches} skipped=${skippedGenerations} ` +
        `avgWaitMs=${averageWaitMs}`
    )
    setObserveSummary({
      generations: observeMaxGenerations,
      bestGeneration,
      bestFitness: Number.isFinite(bestFitness) ? bestFitness : 0,
    })
  }

  const startGeneration = (
    generation: number,
    fitness: number,
    organism: unknown
  ) => {
    if (disposed) return
    let executor: Executor
    try {
      executor = organismToExecutor(observeMethod, organism)
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to create executor'
      console.error(`[OBSERVE] generation=${generation} skipped: ${message}`)
      return
    }

    const previousGeneration = currentGeneration
    if (previousGeneration != null && generation > previousGeneration + 1) {
      skippedGenerations += generation - previousGeneration - 1
    }
    generationSwitches++

    if (currentExecutor == null) {
      waitCount++
      totalWaitMs += performance.now() - waitingStartedAt
    }

    currentExecutor = executor
    currentGeneration = generation
    latestConsumed = true
    const now = performance.now()
    currentRunDeadlineAt = now + OBSERVE_WINDOW_MS
    currentRunBoundaryPassed = false
    summaryShown = false
    shouldTick = true
    setObserveSummary(null)

    // Create a new GameAgent wrapping the executor for this generation
    const stepAgent = createVanillaStepAgent(executor)
    const gameAgent = createGameAgent(stepAgent)
    observeAgent = gameAgent.agent
    aiContext.memory = {}
    replayCounter++
    const gameSeed = `${OBSERVE_SEED}:g${generation}:r${replayCounter}`
    aiContext.rng = createRNG(`${gameSeed}:agent`)

    const applySnapshotToEngine = (
      snapshot: ScenarioSnapshot,
      snapshotSeed: string
    ) => {
      const { state: snapState } = restoreSnapshot(snapshot, snapshotSeed)
      engine.mutate((draft) => {
        draft.ships.clear()
        draft.rocks.clear()
        draft.bullets.clear()
        draft.players.clear()
        draft.now = snapState.now
        draft.wave = snapState.wave
        draft.startedAt = snapState.startedAt
        draft.endedAt = null
        for (const [id, ship] of snapState.ships) draft.ships.set(id, ship)
        for (const [id, rock] of snapState.rocks) draft.rocks.set(id, rock)
        for (const [id, player] of snapState.players)
          draft.players.set(id, player)
      })
    }

    engine.reseed(gameSeed, DEFAULT_PLAYER_ID)

    switch (playbackMode) {
      case 'scenario':
        if (playbackScenarioBank != null && playbackScenarioBank.length > 0) {
          const pickRng = createRNG(`${gameSeed}:scenario-pick`)
          const idx = Math.floor(pickRng.gen() * playbackScenarioBank.length)
          applySnapshotToEngine(playbackScenarioBank[idx], gameSeed)
        }
        break

      case 'curriculum': {
        const params = buildCurriculumParams(curriculumIndex, gameSeed)
        const { snapshot, maxTicks } = generateCurriculumSnapshot(
          params,
          gameSeed,
          33
        )
        const prevIndex = curriculumIndex
        // When pinned, replay the same index; otherwise cycle
        if (curriculumPinIndex == null) {
          curriculumIndex = (curriculumIndex + 1) % CURRICULUM_SCENARIO_COUNT
        }
        curriculumTicksRemaining = maxTicks
        applySnapshotToEngine(snapshot, gameSeed)
        console.log(
          `[OBSERVE] curriculum index=${prevIndex} pattern=${params.pattern} ` +
            `angle=${((params.angle * 180) / Math.PI).toFixed(1)}° rocks=${params.rockCount ?? 1} ` +
            `dist=${params.distance ?? 'far'} maxTicks=${maxTicks}` +
            (curriculumPinIndex != null ? ' (pinned)' : '')
        )
        break
      }

      case 'full-game':
      default:
        // engine.reseed already handled above
        break
    }

    const player = engine.state.players.get(DEFAULT_PLAYER_ID)
    const ship =
      player?.shipId != null ? engine.state.ships.get(player.shipId) : undefined
    const cameraOriginNode = scene.getTransformNodeByName('shipCameraOrigin')
    if (ship != null && cameraOriginNode instanceof TransformNode) {
      const pos = new Vector3(
        ship.position[0] * RADIUS,
        ship.position[1] * RADIUS,
        ship.position[2] * RADIUS
      )
      const [yaw, pitch] = getYawPitch(pos)
      moveNodeTo(cameraOriginNode, yaw, pitch)
    }
    setObserveRunningGeneration(generation)
    setObserveRunningFitness(fitness)
    console.log(
      `[OBSERVE] switch generation=${generation} fitness=${fitness.toFixed(4)} ` +
        `switches=${generationSwitches} skipped=${skippedGenerations}`
    )
  }

  const trySwitchToLatest = (reason: 'startup' | 'boundary' | 'gameover') => {
    if (latestAvailable == null) return false
    if (agentMode === 'best') {
      // Best mode: switch only when there's a new unconsumed all-time best
      if (latestConsumed) return false
    } else {
      // Hero mode: only switch to newer generations
      if (
        currentGeneration != null &&
        latestAvailable.generation <= currentGeneration
      ) {
        return false
      }
    }
    console.log(
      `[OBSERVE] switch reason=${reason} latest=${latestAvailable.generation}`
    )
    startGeneration(
      latestAvailable.generation,
      latestAvailable.fitness,
      latestAvailable.organism
    )
    return true
  }

  const exitToMode = (mode: AppMode) => {
    inputs.reset()
    setAppMode(mode)
  }

  const unbindBest = adapter.onGenerationBest((evt) => {
    if (disposed) return
    generationEvents++
    if (evt.fitness > bestFitness) {
      bestFitness = evt.fitness
      bestGeneration = evt.generation
    }

    if (agentMode === 'best') {
      // Best mode: only update when fitness is a new all-time best
      if (latestAvailable == null || evt.fitness > latestAvailable.fitness) {
        latestAvailable = {
          generation: evt.generation,
          fitness: evt.fitness,
          organism: evt.organism,
        }
        latestConsumed = false
      }
    } else {
      // Hero mode: always take the latest generation's best
      if (
        latestAvailable == null ||
        evt.generation >= latestAvailable.generation
      ) {
        latestAvailable = {
          generation: evt.generation,
          fitness: evt.fitness,
          organism: evt.organism,
        }
      }
    }

    if (currentExecutor == null) {
      trySwitchToLatest('startup')
      return
    }
    if (currentRunBoundaryPassed) {
      trySwitchToLatest('boundary')
    }
  })

  const unbindStatus = adapter.onStatus((evt) => {
    if (disposed) return
    startWaiting(evt.generationTarget)
    if (evt.phase === 'completed') {
      trainingCompleted = true
      maybeShowSummary()
      return
    }
    if (evt.phase === 'error' && evt.message != null) {
      console.error(`[OBSERVE] training error: ${evt.message}`)
    }
  })

  startWaiting(1)

  void adapter.start({
    ...profileOptions,
    ...urlOverrides,
    iterations: observeMaxGenerations,
    evaluationSeedsPerOrganism:
      profileOptions.evaluationSeedsPerOrganism ??
      OBSERVE_EVALUATION_SEEDS_PER_ORGANISM,
    evaluationBaseSeed: OBSERVE_SEED,
    ...(observeRLMode != null && { rlMode: observeRLMode }),
    ...(observeRLWarmup != null && { rlWarmupGenerations: observeRLWarmup }),
  })

  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      exitToMode('play')
      return
    }

    if (!summaryShown) return
    if (event.shiftKey && event.key === 'S') {
      event.preventDefault()
      exitToMode('spawn-debug')
      return
    }
    if (event.shiftKey && event.key === 'R') {
      event.preventDefault()
      exitToMode('record')
      return
    }
    if (event.shiftKey && event.key === 'P') {
      event.preventDefault()
      exitToMode('playback')
      return
    }
    if (event.shiftKey && event.key === 'O') {
      event.preventDefault()
      setAppMode('play')
      queueMicrotask(() => {
        if (disposed) return
        setAppMode('observe')
      })
      return
    }
    if (
      event.key === ' ' ||
      event.key === 'Space' ||
      event.key === 'Spacebar'
    ) {
      event.preventDefault()
      inputs.reset()
      engine.mutate((state) => {
        restartGame(state, DEFAULT_PLAYER_ID, engine.rng)
      })
      exitToMode('play')
    }
  }

  window.addEventListener('keydown', handleKeyDown)
  const beforeRender = scene.onBeforeRenderObservable.add(() => {
    if (disposed) return
    if (currentExecutor == null) {
      const elapsedSeconds = Math.floor(
        (performance.now() - waitingStartedAt) / 1000
      )
      setObserveTrainingElapsedSeconds(elapsedSeconds)
      maybeShowSummary()
      return
    }
    if (!shouldTick) return

    const dtMs = Math.min(scene.getEngine().getDeltaTime(), MAX_DELTA)
    if (observeAgent == null) return
    const aiInput = observeAgent(engine.state, DEFAULT_PLAYER_ID, aiContext)
    engine.tick({ [DEFAULT_PLAYER_ID]: aiInput }, dtMs)

    // Curriculum tick budget: count down and treat expiry like gameover
    if (playbackMode === 'curriculum') {
      curriculumTicksRemaining--
      if (curriculumTicksRemaining <= 0 && engine.state.endedAt == null) {
        console.log(`[OBSERVE] curriculum tick budget expired, advancing`)
        // Treat as gameover — fall through to gameover handling below
        engine.mutate((draft) => {
          draft.endedAt = draft.now
        })
      }
    }

    if (
      !currentRunBoundaryPassed &&
      performance.now() >= currentRunDeadlineAt
    ) {
      currentRunBoundaryPassed = true
      if (trySwitchToLatest('boundary')) return
    }

    const ended = engine.state.endedAt != null
    if (!ended) return

    if (trySwitchToLatest('gameover')) return

    // In best mode, replay the current best organism on game over
    if (agentMode === 'best' && latestAvailable != null) {
      startGeneration(
        latestAvailable.generation,
        latestAvailable.fitness,
        latestAvailable.organism
      )
      return
    }

    if (trainingCompleted) {
      return
    }

    const nextTarget =
      currentGeneration != null
        ? currentGeneration + 1
        : trainingTargetGeneration
    stopRunning()
    startWaiting(nextTarget, true)
    maybeShowSummary()
  })

  onCleanup(() => {
    disposed = true
    shouldTick = false
    scene.onBeforeRenderObservable.remove(beforeRender)
    window.removeEventListener('keydown', handleKeyDown)
    unbindBest()
    unbindStatus()
    void adapter.stop()
    setObserveTrainingElapsedSeconds(0)
    setObserveRunningGeneration(null)
    setObserveRunningFitness(null)
  })

  return null
}
