import { useGameState } from '@heygrady/hexagonoids-engine/solid'
import { type Component, createMemo } from 'solid-js'

import { DEFAULT_PLAYER_ID } from '../constants'

export interface PlaybackOverlayProps {
  seedIndex: number
  seedName: string
  totalSeeds: number
  frameIndex: number
  totalFrames: number
}

/**
 * HUD overlay showing playback status: play indicator, seed counter,
 * progress bar, score, and escape hint. Positioned absolutely over the canvas.
 */
export const PlaybackOverlay: Component<PlaybackOverlayProps> = (props) => {
  const engine = useGameState()

  const score = createMemo(() => {
    const player = engine.state.players.get(DEFAULT_PLAYER_ID)
    return player?.score ?? 0
  })

  const progress = createMemo(() => {
    if (props.totalFrames === 0) return 0
    return Math.min(1, props.frameIndex / props.totalFrames)
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
      {/* Play indicator */}
      <div style={{ display: 'flex', 'align-items': 'center', gap: '8px' }}>
        <span style={{ 'font-size': '16px', color: '#22c55e' }}>▶</span>
        <span style={{ 'font-weight': 'bold', color: '#22c55e' }}>
          PLAYBACK
        </span>
      </div>

      {/* Session counter and seed */}
      <div>
        Session {props.seedIndex + 1}/{props.totalSeeds} — seed:{' '}
        {props.seedName}
      </div>

      {/* Progress bar */}
      <div
        style={{
          width: '160px',
          height: '6px',
          'background-color': 'rgba(255,255,255,0.2)',
          'border-radius': '3px',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: `${Math.round(progress() * 100)}%`,
            height: '100%',
            'background-color': '#22c55e',
            transition: 'width 0.1s linear',
          }}
        />
      </div>

      {/* Score */}
      <div>Score: {score()}</div>

      {/* Escape hint */}
      <div style={{ 'font-size': '12px', opacity: '0.7' }}>
        Press Escape to exit
      </div>
    </div>
  )
}
