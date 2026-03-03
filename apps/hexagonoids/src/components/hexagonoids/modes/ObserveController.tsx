import { Vector3 } from '@babylonjs/core/Maths/math.vector'
import { TransformNode } from '@babylonjs/core/Meshes/transformNode'
import { latLngToVector3 } from '@heygrady/h3-babylon'
import {
  SUPPORTED_ALGORITHMS,
  type SupportedAlgorithm,
} from '@heygrady/hexagonoids-demo'
import { MAX_DELTA, restartGame } from '@heygrady/hexagonoids-engine'
import { useGameState } from '@heygrady/hexagonoids-engine/solid'
import {
  type AgentContext,
  createNeatAgent,
  decodeScenarioBankDocument,
  type EncodingPreset,
  isEncodingPreset,
  restoreSnapshot,
  type ScenarioSnapshot,
} from '@heygrady/hexagonoids-environment'
import type { SyncExecutor } from '@neat-evolution/executor'
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
  OBSERVE_SCENARIO_MAX_TICKS,
  OBSERVE_SCENARIOS_PER_ORGANISM,
  OBSERVE_SEED,
  OBSERVE_WINDOW_MS,
} from './constants'
import {
  createObserveTrainingAdapter,
  type ObserveTrainingConfig,
  organismToExecutor,
} from './training/createObserveTrainingAdapter'
import { getObserveProfile } from './training/profiles'

/**
 * Observe-mode shell. Session 01 wires mode entry/exit and HUD ownership.
 * Training/playback runtime is implemented in later sessions.
 */
export function ObserveController() {
  const DEFAULT_OBSERVE_ENCODING_PRESET: EncodingPreset = 'six'
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
  let currentExecutor: SyncExecutor | null = null
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
    executor: undefined,
    spatialQueries: engine,
  }

  const adapter = createObserveTrainingAdapter()

  // ── Resolve config: profile defaults → URL param overrides ──
  const searchParams = new URLSearchParams(window.location.search)

  const profileName = searchParams.get('profile') ?? 'default'
  const profileConfig: Partial<ObserveTrainingConfig> =
    getObserveProfile(profileName) ?? {}
  if (Object.keys(profileConfig).length > 0) {
    console.log(`[OBSERVE] profile=${profileName}`, profileConfig)
  } else if (profileName !== 'default') {
    console.log(`[OBSERVE] profile=${profileName} (not found)`)
  }

  // Method: profile → URL override
  let observeMethod: SupportedAlgorithm = profileConfig.method ?? 'HyperNEAT'
  const requestedMethod = searchParams.get('method')
  if (
    requestedMethod != null &&
    SUPPORTED_ALGORITHMS.includes(requestedMethod as SupportedAlgorithm)
  ) {
    observeMethod = requestedMethod as SupportedAlgorithm
  } else if (requestedMethod != null) {
    console.warn(
      `[OBSERVE] Unsupported method "${requestedMethod}", using ${observeMethod}`
    )
  }

  // Encoding preset: profile → URL override
  let observeEncodingPreset: EncodingPreset =
    profileConfig.encodingPreset ?? DEFAULT_OBSERVE_ENCODING_PRESET
  const requestedEncodingPreset = searchParams.get('encodingPreset')
  if (
    requestedEncodingPreset != null &&
    isEncodingPreset(requestedEncodingPreset)
  ) {
    observeEncodingPreset = requestedEncodingPreset
  } else if (requestedEncodingPreset != null) {
    console.log(
      `[OBSERVE] Unsupported encodingPreset "${requestedEncodingPreset}", using ${observeEncodingPreset}`
    )
  }
  const observeAgent = createNeatAgent(observeEncodingPreset)

  const agentMode = searchParams.get('agent') === 'best' ? 'best' : 'hero'
  const scenarioPlayback = searchParams.get('scenario') === 'true'
  const observeMaxGenerations =
    profileConfig.maxGenerations ?? OBSERVE_MAX_GENERATIONS

  let playbackScenarioBank: ScenarioSnapshot[] | null = null
  if (scenarioPlayback) {
    void import('@heygrady/hexagonoids-demo/data/scenarios.json')
      .then((mod) => {
        playbackScenarioBank = decodeScenarioBankDocument(mod.default ?? mod)
        console.log(
          `[OBSERVE] Loaded ${playbackScenarioBank.length} scenarios for playback`
        )
      })
      .catch(() => {
        console.warn('[OBSERVE] Failed to load scenarios for playback')
      })
  }

  console.log(
    `[OBSERVE] method=${observeMethod}, encodingPreset=${observeEncodingPreset}, agent=${agentMode}, maxGenerations=${observeMaxGenerations}`
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
    aiContext.executor = undefined
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
    let executor: SyncExecutor
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

    aiContext.executor = executor
    aiContext.memory = {}
    replayCounter++
    const gameSeed = `${OBSERVE_SEED}:g${generation}:r${replayCounter}`
    aiContext.rng = createRNG(`${gameSeed}:agent`)

    engine.reseed(gameSeed, DEFAULT_PLAYER_ID)

    // In scenario playback mode, overwrite the fresh game with a random scenario
    if (
      scenarioPlayback &&
      playbackScenarioBank != null &&
      playbackScenarioBank.length > 0
    ) {
      const pickRng = createRNG(`${gameSeed}:scenario-pick`)
      const idx = Math.floor(pickRng.gen() * playbackScenarioBank.length)
      const scenario = playbackScenarioBank[idx]
      const { state: snapState } = restoreSnapshot(scenario, gameSeed)

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

    const player = engine.state.players.get(DEFAULT_PLAYER_ID)
    const ship =
      player?.shipId != null ? engine.state.ships.get(player.shipId) : undefined
    const cameraOriginNode = scene.getTransformNodeByName('shipCameraOrigin')
    if (ship != null && cameraOriginNode instanceof TransformNode) {
      const { x, y, z } = ship
      const pos =
        typeof x === 'number' && typeof y === 'number' && typeof z === 'number'
          ? new Vector3(x * RADIUS, y * RADIUS, z * RADIUS)
          : latLngToVector3(ship.lat, ship.lng, RADIUS)
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
    method: observeMethod,
    encodingPreset: observeEncodingPreset,
    maxGenerations: observeMaxGenerations,
    populationSize: profileConfig.populationSize ?? 64,
    evaluationSeedsPerOrganism:
      profileConfig.evaluationSeedsPerOrganism ??
      OBSERVE_EVALUATION_SEEDS_PER_ORGANISM,
    evaluationBaseSeed: OBSERVE_SEED,
    maxTicks: profileConfig.maxTicks ?? 1500,
    dtMs: 33,
    scenarioMode: true,
    scenariosPerOrganism:
      profileConfig.scenariosPerOrganism ?? OBSERVE_SCENARIOS_PER_ORGANISM,
    scenarioMaxTicks:
      profileConfig.scenarioMaxTicks ?? OBSERVE_SCENARIO_MAX_TICKS,
    ...(profileConfig.fitnessWeights != null && {
      fitnessWeights: profileConfig.fitnessWeights,
    }),
    ...(profileConfig.gateConfig != null && {
      gateConfig: profileConfig.gateConfig,
    }),
    ...(profileConfig.scenarioWeight != null && {
      scenarioWeight: profileConfig.scenarioWeight,
    }),
    ...(profileConfig.scenarioSeedsPerOrganism != null && {
      scenarioSeedsPerOrganism: profileConfig.scenarioSeedsPerOrganism,
    }),
    ...(profileConfig.fullGameSeedsPerOrganism != null && {
      fullGameSeedsPerOrganism: profileConfig.fullGameSeedsPerOrganism,
    }),
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
    aiContext.executor = currentExecutor
    const aiInput = observeAgent(engine.state, DEFAULT_PLAYER_ID, aiContext)
    engine.tick({ [DEFAULT_PLAYER_ID]: aiInput }, dtMs)

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
