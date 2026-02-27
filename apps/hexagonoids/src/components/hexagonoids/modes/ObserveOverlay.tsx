import { type Component, Show } from 'solid-js'

import { useAppMode } from './AppModeProvider'

export const ObserveOverlay: Component = () => {
  const {
    appMode,
    observeTrainingGeneration,
    observeTrainingElapsedSeconds,
    observeRunningGeneration,
    observeRunningFitness,
    observeSummary,
  } = useAppMode()

  const isObserveMode = () => appMode() === 'observe'
  const runningGeneration = () => observeRunningGeneration()
  const isRunning = () => isObserveMode() && runningGeneration() != null
  const isTraining = () =>
    isObserveMode() && !isRunning() && observeSummary() == null

  return (
    <>
      <Show when={isTraining()}>
        <div
          style={{
            position: 'absolute',
            top: '16px',
            left: '16px',
            'z-index': '110',
            'font-family': 'monospace',
            'font-size': '14px',
            color: '#facc15',
            'text-shadow': '0 0 4px rgba(0,0,0,0.85)',
            'pointer-events': 'none',
          }}
        >
          Training Generation {observeTrainingGeneration()} for{' '}
          {observeTrainingElapsedSeconds()}s
        </div>
      </Show>
      <Show when={isRunning()}>
        <div
          style={{
            position: 'absolute',
            bottom: '24px',
            left: '50%',
            transform: 'translateX(-50%)',
            'z-index': '110',
            'font-family': 'monospace',
            'font-size': '14px',
            color: 'white',
            'text-shadow': '0 0 4px rgba(0,0,0,0.85)',
            'pointer-events': 'none',
          }}
        >
          Generation {runningGeneration()}, Fitness{' '}
          {(observeRunningFitness() ?? 0).toFixed(2)}
        </div>
      </Show>
      <Show when={isObserveMode() && observeSummary() != null}>
        <div
          style={{
            position: 'absolute',
            inset: '0',
            'z-index': '120',
            display: 'flex',
            'align-items': 'center',
            'justify-content': 'center',
            'background-color': 'rgba(0,0,0,0.7)',
            color: 'white',
            'font-family': 'monospace',
            'pointer-events': 'none',
          }}
        >
          <div style={{ 'text-align': 'center', 'line-height': 1.6 }}>
            <div>
              Trained {observeSummary()!.generations} generations. Best fitness{' '}
              {observeSummary()!.bestFitness.toFixed(2)} at generation{' '}
              {observeSummary()!.bestGeneration}.
            </div>
            <div>Space: Play | Shift+O: Observe | Shift+S: Spawn Debug</div>
          </div>
        </div>
      </Show>
    </>
  )
}
