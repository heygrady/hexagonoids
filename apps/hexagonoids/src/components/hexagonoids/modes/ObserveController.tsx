import { TransformNode } from '@babylonjs/core/Meshes/transformNode'
import { latLngToVector3 } from '@heygrady/h3-babylon'
import { MAX_DELTA, restartGame } from '@heygrady/hexagonoids-engine'
import { useGameState } from '@heygrady/hexagonoids-engine/solid'
import type { SyncExecutor } from '@neat-evolution/executor'
import { createRNG } from '@neat-evolution/utils'
import { onCleanup } from 'solid-js'

import { neatAgent } from '../../../../../../packages/hexagonoids-environment/src/agents/neatAgent'
import type { AgentContext } from '../../../../../../packages/hexagonoids-environment/src/agents/types'
import { useScene } from '../../solid-babylon/hooks/useScene'
import { DEFAULT_PLAYER_ID, RADIUS } from '../constants'
import { useInputs } from '../engine/useInputBridge'
import { getYawPitch } from '../ship/getYawPitch'
import { moveNodeTo } from '../ship/orientation'
import type { AppMode } from '../types'
import { useAppMode } from './AppModeProvider'
import {
  OBSERVE_MAX_GENERATIONS,
  OBSERVE_SEED,
  OBSERVE_WINDOW_MS,
} from './constants'
import {
  createObserveTrainingAdapter,
  organismToExecutor,
} from './training/createObserveTrainingAdapter'

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

  const aiContext: AgentContext = {
    rng: createRNG(`${OBSERVE_SEED}:agent`),
    memory: {},
    executor: undefined,
  }

  const adapter = createObserveTrainingAdapter()

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
    if (!trainingCompleted || currentExecutor != null || summaryShown) return
    summaryShown = true
    shouldTick = false
    const averageWaitMs =
      waitCount > 0 ? Math.round(totalWaitMs / waitCount) : 0
    console.log(
      `[OBSERVE] completed generations=${OBSERVE_MAX_GENERATIONS} bestGen=${bestGeneration} ` +
        `bestFitness=${Number.isFinite(bestFitness) ? bestFitness.toFixed(2) : '0.00'} ` +
        `events=${generationEvents} switches=${generationSwitches} skipped=${skippedGenerations} ` +
        `avgWaitMs=${averageWaitMs}`
    )
    setObserveSummary({
      generations: OBSERVE_MAX_GENERATIONS,
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
      executor = organismToExecutor(organism)
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
    const now = performance.now()
    currentRunDeadlineAt = now + OBSERVE_WINDOW_MS
    currentRunBoundaryPassed = false
    summaryShown = false
    shouldTick = true
    setObserveSummary(null)

    aiContext.executor = executor
    aiContext.memory = {}
    aiContext.rng = createRNG(`${OBSERVE_SEED}:g${generation}`)

    engine.reseed(OBSERVE_SEED, DEFAULT_PLAYER_ID)
    const player = engine.state.players.get(DEFAULT_PLAYER_ID)
    const ship =
      player?.shipId != null ? engine.state.ships.get(player.shipId) : undefined
    const cameraOriginNode = scene.getTransformNodeByName('shipCameraOrigin')
    if (ship != null && cameraOriginNode instanceof TransformNode) {
      const pos = latLngToVector3(ship.lat, ship.lng, RADIUS)
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
    if (
      currentGeneration != null &&
      latestAvailable.generation <= currentGeneration
    ) {
      return false
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
    maxGenerations: OBSERVE_MAX_GENERATIONS,
    populationSize: 64,
    maxTicks: 1500,
    dtMs: 33,
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
    const aiInput = neatAgent(engine.state, DEFAULT_PLAYER_ID, aiContext)
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
