import { render, screen } from '@solidjs/testing-library'
import { describe, expect, it, vi } from 'vitest'

const { mockPlayers } = vi.hoisted(() => ({
  mockPlayers: new Map([['player-1', { score: 42 }]]),
}))

vi.mock('@heygrady/hexagonoids-engine/solid', () => ({
  useGameState: () => ({ state: { players: mockPlayers } }),
}))

import { PlaybackOverlay } from '../../../src/components/hexagonoids/modes/PlaybackOverlay'

describe('PlaybackOverlay', () => {
  it('renders playback HUD data from props and game state', () => {
    render(() => (
      <PlaybackOverlay
        playerId="player-1"
        seedIndex={1}
        seedName="seed-A"
        totalSeeds={3}
        frameIndex={30}
        totalFrames={60}
        bestScore={50}
        avgScore={35.4}
      />
    ))

    expect(screen.getByText('PLAYBACK')).toBeInTheDocument()
    expect(screen.getByText(/Session 2\/3/)).toBeInTheDocument()
    expect(screen.getByText(/seed: seed-A/)).toBeInTheDocument()
    expect(screen.getByText('Score: 42')).toBeInTheDocument()
    expect(screen.getByText('Best: 50 | Avg: 35')).toBeInTheDocument()
    expect(screen.getByText('Press Escape to exit')).toBeInTheDocument()
  })
})
