import { onCleanup } from 'solid-js'

import { useAppMode } from './AppModeProvider'

/**
 * Observe-mode shell. Session 01 wires mode entry/exit and HUD ownership.
 * Training/playback runtime is implemented in later sessions.
 */
export function ObserveController() {
  const {
    setAppMode,
    setObserveTrainingGeneration,
    setObserveTrainingElapsedSeconds,
    setObserveRunningGeneration,
    setObserveRunningFitness,
    setObserveSummary,
  } = useAppMode()

  setObserveTrainingGeneration(1)
  setObserveTrainingElapsedSeconds(0)
  setObserveRunningGeneration(null)
  setObserveRunningFitness(null)
  setObserveSummary(null)

  const startedAt = performance.now()
  const interval = window.setInterval(() => {
    const elapsedSeconds = Math.floor((performance.now() - startedAt) / 1000)
    setObserveTrainingElapsedSeconds(elapsedSeconds)
  }, 250)

  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.key !== 'Escape') return
    event.preventDefault()
    setAppMode('play')
  }

  window.addEventListener('keydown', handleKeyDown)

  onCleanup(() => {
    clearInterval(interval)
    window.removeEventListener('keydown', handleKeyDown)
    setObserveTrainingElapsedSeconds(0)
    setObserveRunningGeneration(null)
    setObserveRunningFitness(null)
  })

  return null
}
