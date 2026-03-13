import { type Component, createSignal, Show } from 'solid-js'

import { useAppMode } from './AppModeProvider'

/**
 * Player name prompt. Shown when no playerId exists in localStorage.
 * On submit, slugifies the name and stores it via AppModeProvider context.
 */
export const PlayerIdentity: Component = () => {
  const { playerId, setPlayerId } = useAppMode()
  const [name, setName] = createSignal('')

  function handleSubmit(e: Event) {
    e.preventDefault()
    const value = name().trim()
    if (value.length === 0) return
    setPlayerId(value)
  }

  return (
    <Show when={playerId().length === 0}>
      <div
        style={{
          position: 'absolute',
          inset: '0',
          'z-index': '200',
          display: 'flex',
          'align-items': 'center',
          'justify-content': 'center',
          'background-color': 'rgba(0,0,0,0.85)',
        }}
      >
        <form
          onSubmit={handleSubmit}
          style={{
            display: 'flex',
            'flex-direction': 'column',
            gap: '16px',
            'align-items': 'center',
            'font-family': 'monospace',
            color: 'white',
          }}
        >
          <label
            style={{ 'font-size': '18px', 'font-weight': 'bold' }}
            for="player-name"
          >
            Enter your name for recordings:
          </label>
          <input
            id="player-name"
            type="text"
            value={name()}
            onInput={(e) => setName(e.currentTarget.value)}
            placeholder="e.g. grady"
            autocomplete="off"
            style={{
              padding: '8px 12px',
              'font-size': '16px',
              'font-family': 'monospace',
              'background-color': 'rgba(255,255,255,0.1)',
              border: '1px solid rgba(255,255,255,0.3)',
              'border-radius': '4px',
              color: 'white',
              'min-width': '200px',
              'text-align': 'center',
            }}
          />
          <button
            type="submit"
            style={{
              padding: '8px 24px',
              'font-size': '14px',
              'font-family': 'monospace',
              'background-color': 'rgba(255,255,255,0.15)',
              border: '1px solid rgba(255,255,255,0.3)',
              'border-radius': '4px',
              color: 'white',
              cursor: 'pointer',
            }}
          >
            Start
          </button>
        </form>
      </div>
    </Show>
  )
}
