import { MAX_DELTA } from '@heygrady/hexagonoids-engine'
import { useGameState } from '@heygrady/hexagonoids-engine/solid'
import type { SyncExecutor } from '@neat-evolution/executor'
import { createRNG } from '@neat-evolution/utils'
import { onCleanup } from 'solid-js'

import { neatAgent } from '../../../../../../packages/hexagonoids-environment/src/agents/neatAgent'
import type { AgentContext } from '../../../../../../packages/hexagonoids-environment/src/agents/types'
import { useScene } from '../../solid-babylon/hooks/useScene'
import { DEFAULT_PLAYER_ID } from '../constants'
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
  const {
    setAppMode,
    setObserveTrainingGeneration,
    setObserveTrainingElapsedSeconds,
    setObserveRunningGeneration,
    setObserveRunningFitness,
    setObserveSummary,
  } = useAppMode()

  let disposed = false
  let currentExecutor: SyncExecutor | null = null
  let bestFitness = Number.NEGATIVE_INFINITY
  let bestGeneration = 0
  let trainingCompleted = false
  let runStartedAt = 0

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

  const unbindBest = adapter.onGenerationBest((evt) => {
    if (disposed) return
    if (evt.fitness > bestFitness) {
      bestFitness = evt.fitness
      bestGeneration = evt.generation
    }
    currentExecutor = organismToExecutor(evt.organism)
    aiContext.executor = currentExecutor
    aiContext.memory = {}
    aiContext.rng = createRNG(`${OBSERVE_SEED}:g${evt.generation}`)
    runStartedAt = performance.now()

    engine.reseed(OBSERVE_SEED, DEFAULT_PLAYER_ID)
    setObserveRunningGeneration(evt.generation)
    setObserveRunningFitness(evt.fitness)
  })

  const unbindStatus = adapter.onStatus((evt) => {
    if (disposed) return
    setObserveTrainingGeneration(Math.max(1, evt.generationTarget))
    setObserveTrainingElapsedSeconds(Math.floor(evt.elapsedMs / 1000))
    if (evt.phase === 'completed') {
      trainingCompleted = true
    }
  })

  void adapter.start({
    maxGenerations: OBSERVE_MAX_GENERATIONS,
    populationSize: 64,
    maxTicks: 1500,
    dtMs: 33,
  })

  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.key !== 'Escape') return
    event.preventDefault()
    setAppMode('play')
  }

  window.addEventListener('keydown', handleKeyDown)
  const beforeRender = scene.onBeforeRenderObservable.add(() => {
    const dtMs = Math.min(scene.getEngine().getDeltaTime(), MAX_DELTA)
    if (currentExecutor == null) return

    aiContext.executor = currentExecutor
    const aiInput = neatAgent(engine.state, DEFAULT_PLAYER_ID, aiContext)
    engine.tick({ [DEFAULT_PLAYER_ID]: aiInput }, dtMs)

    const ended = engine.state.endedAt != null
    const runExpired = performance.now() - runStartedAt >= OBSERVE_WINDOW_MS
    if (!ended && !runExpired) return

    setObserveRunningGeneration(null)
    setObserveRunningFitness(null)
    currentExecutor = null
    aiContext.executor = undefined
    aiContext.memory = {}

    if (trainingCompleted) {
      setObserveSummary({
        generations: OBSERVE_MAX_GENERATIONS,
        bestGeneration,
        bestFitness: Number.isFinite(bestFitness) ? bestFitness : 0,
      })
    }
  })

  onCleanup(() => {
    disposed = true
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
