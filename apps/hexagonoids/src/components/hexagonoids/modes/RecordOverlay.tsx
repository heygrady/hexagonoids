import { useGameState } from '@heygrady/hexagonoids-engine/solid'
import { type Component, createMemo } from 'solid-js'

import { DEFAULT_PLAYER_ID } from '../constants'
import { BENCHMARK_SEEDS, SESSION_DURATION } from './constants'

export interface RecordOverlayProps {
  seedIndex: number
  sessionStartTime: number
}

/**
 * HUD overlay showing recording status: REC indicator, seed counter,
 * countdown timer, and current score. Positioned absolutely over the canvas.
 */
export const RecordOverlay: Component<RecordOverlayProps> = (props) => {
  const engine = useGameState()

  const elapsed = createMemo(() => engine.state.now - props.sessionStartTime)

  const remaining = createMemo(() => {
    const ms = Math.max(0, SESSION_DURATION - elapsed())
    return (ms / 1000).toFixed(1)
  })

  const score = createMemo(() => {
    const player = engine.state.players.get(DEFAULT_PLAYER_ID)
    return player?.score ?? 0
  })

  return (
    <div
      style={{
        position: 'absolute',
        top: '16px',
        left: '16px',
        'z-index': '100',
        display: 'flex',
        'flex-direction': 'column',
        gap: '8px',
        'font-family': 'monospace',
        'font-size': '14px',
        color: 'white',
        'pointer-events': 'none',
        'text-shadow': '0 0 4px rgba(0,0,0,0.8)',
      }}
    >
      {/* REC indicator */}
      <div style={{ display: 'flex', 'align-items': 'center', gap: '8px' }}>
        <div
          class="animate-pulse"
          style={{
            width: '12px',
            height: '12px',
            'border-radius': '50%',
            'background-color': '#ef4444',
          }}
        />
        <span style={{ 'font-weight': 'bold', color: '#ef4444' }}>REC</span>
      </div>

      {/* Seed counter */}
      <div>
        Seed {props.seedIndex + 1}/{BENCHMARK_SEEDS.length}
      </div>

      {/* Countdown timer */}
      <div>{remaining()}s</div>

      {/* Score */}
      <div>Score: {score()}</div>
    </div>
  )
}
