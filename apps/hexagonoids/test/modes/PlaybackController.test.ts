import { render, waitFor } from '@solidjs/testing-library'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// --- Hoisted mocks (vi.hoisted runs at hoist time alongside vi.mock) ---
const {
  mockTick,
  mockReseed,
  mockReset,
  mockSetAppMode,
  mockGetDeltaTime,
  mockObservableAdd,
  mockObservableRemove,
  mockListQuery,
  mockGetQuery,
  triggerSelectAll,
} = vi.hoisted(() => ({
  mockTick: vi.fn(),
  mockReseed: vi.fn(),
  mockReset: vi.fn(),
  mockSetAppMode: vi.fn(),
  mockGetDeltaTime: vi.fn(() => 16.67),
  mockObservableAdd: vi.fn(),
  mockObservableRemove: vi.fn(),
  mockListQuery: vi.fn(),
  mockGetQuery: vi.fn(),
  triggerSelectAll: { current: null as null | (() => void) },
}))

// --- Module mocks ---
vi.mock('@heygrady/hexagonoids-engine/solid', () => ({
  useGameState: () => ({
    tick: mockTick,
    reseed: mockReseed,
    state: { players: new Map() },
  }),
}))

vi.mock('../../src/components/solid-babylon/hooks/useScene.js', () => ({
  useScene: () => ({
    onBeforeRenderObservable: {
      add: mockObservableAdd,
      remove: mockObservableRemove,
    },
    getEngine: () => ({ getDeltaTime: mockGetDeltaTime }),
  }),
}))

vi.mock('../../src/components/hexagonoids/engine/useInputBridge.js', () => ({
  useInputs: () => ({
    left: false,
    right: false,
    thrust: false,
    fire: false,
    reset: mockReset,
  }),
}))

vi.mock('../../src/components/hexagonoids/modes/AppModeProvider.js', () => ({
  useAppMode: () => ({
    appMode: () => 'playback',
    setAppMode: mockSetAppMode,
    playerId: () => 'test-player',
    setPlayerId: () => {},
  }),
}))

vi.mock('../../src/components/hexagonoids/modes/trpc.js', () => ({
  trpc: {
    sessions: {
      list: { query: mockListQuery },
      get: { query: mockGetQuery },
      exportBenchmarks: {
        query: vi
          .fn()
          .mockResolvedValue({ playerId: 'test-player', seeds: {} }),
      },
    },
  },
}))

vi.mock('../../src/components/hexagonoids/modes/PlaybackOverlay.js', () => ({
  PlaybackOverlay: () => null,
}))

vi.mock('../../src/components/hexagonoids/modes/SessionBrowser.js', () => ({
  SessionBrowser: (props: { onSelectAll: () => void }) => {
    triggerSelectAll.current = props.onSelectAll
    return null
  },
}))

import { PlaybackController } from '../../src/components/hexagonoids/modes/PlaybackController.js'

describe('PlaybackController', () => {
  let warnSpy: ReturnType<typeof vi.spyOn> | null = null
  let errorSpy: ReturnType<typeof vi.spyOn> | null = null
  let logSpy: ReturnType<typeof vi.spyOn> | null = null

  beforeEach(() => {
    vi.clearAllMocks()
    triggerSelectAll.current = null
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
  })

  afterEach(() => {
    warnSpy?.mockRestore()
    errorSpy?.mockRestore()
    logSpy?.mockRestore()
    warnSpy = null
    errorSpy = null
    logSpy = null
  })

  it('replays frames using accumulator-based timing with recorded dt values', async () => {
    // Arrange: server returns one benchmark seed with 3 frames
    mockListQuery.mockResolvedValue(['benchmark-001'])
    mockGetQuery.mockResolvedValue({
      frames: [
        { dt: 10, i: 5 }, // left + thrust
        { dt: 10, i: 3 }, // left + right
        { dt: 10, i: 8 }, // fire
      ],
    })

    render(() => PlaybackController())
    triggerSelectAll.current?.()

    await waitFor(() => {
      expect(mockGetQuery).toHaveBeenCalled()
    })

    // Get the beforeRender callback
    const beforeRenderCallback = mockObservableAdd.mock
      .calls[0]![0] as () => void

    // Act: simulate a render frame with 25ms delta (enough for 2 frames of dt=10)
    mockGetDeltaTime.mockReturnValue(25)
    beforeRenderCallback()

    // Assert: 2 frames consumed (10 + 10 = 20 ≤ 25), 5ms remains in accumulator
    expect(mockTick).toHaveBeenCalledTimes(2)
    expect(mockTick).toHaveBeenNthCalledWith(
      1,
      {
        'test-player': { left: true, right: false, thrust: true, fire: false },
      },
      10
    )
    expect(mockTick).toHaveBeenNthCalledWith(
      2,
      {
        'test-player': { left: true, right: true, thrust: false, fire: false },
      },
      10
    )
  })

  it('does not tick when still loading', () => {
    // Arrange: list query returns a promise that never resolves
    mockListQuery.mockReturnValue(new Promise(() => {}))

    render(() => PlaybackController())
    triggerSelectAll.current?.()

    // Get the beforeRender callback
    const beforeRenderCallback = mockObservableAdd.mock
      .calls[0]![0] as () => void

    // Act: simulate a render frame while loading
    mockGetDeltaTime.mockReturnValue(100)
    beforeRenderCallback()

    // Assert: no ticks because loading flag is still true
    expect(mockTick).not.toHaveBeenCalled()
  })

  it('reseeds engine with the session seed on load', async () => {
    // Arrange
    mockListQuery.mockResolvedValue(['benchmark-003'])
    mockGetQuery.mockResolvedValue({ frames: [{ dt: 10, i: 0 }] })

    render(() => PlaybackController())
    triggerSelectAll.current?.()
    await waitFor(() => {
      expect(mockReseed).toHaveBeenCalledWith('benchmark-003', 'test-player')
    })

    // Assert: engine was reseeded with the session seed
    expect(mockReseed).toHaveBeenCalledWith('benchmark-003', 'test-player')
  })

  it('exits playback and resets when Escape is pressed', async () => {
    // Arrange
    mockListQuery.mockResolvedValue(['benchmark-001'])
    mockGetQuery.mockResolvedValue({ frames: [{ dt: 10, i: 0 }] })

    render(() => PlaybackController())
    triggerSelectAll.current?.()
    await waitFor(() => {
      expect(mockGetQuery).toHaveBeenCalled()
    })

    // Act: simulate Escape keydown
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))

    // Assert: exits back to play mode
    expect(mockSetAppMode).toHaveBeenCalledWith('play')
    expect(mockReset).toHaveBeenCalled()
  })

  it('exits playback when no benchmark recordings are available', async () => {
    // Arrange: server returns seeds but none match benchmarks
    mockListQuery.mockResolvedValue(['custom-seed-xyz'])

    render(() => PlaybackController())
    triggerSelectAll.current?.()
    await waitFor(() => {
      expect(mockSetAppMode).toHaveBeenCalledWith('play')
    })

    // Assert: falls back to play mode since no benchmark seeds matched
    expect(mockSetAppMode).toHaveBeenCalledWith('play')
  })
})
