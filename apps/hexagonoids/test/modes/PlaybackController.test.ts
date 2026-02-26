import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Stub React for JSX compilation (SolidJS TSX compiles to React.createElement in test env)
vi.stubGlobal('React', { createElement: () => null })

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
  mockOnCleanup,
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
  mockOnCleanup: vi.fn(),
}))

// --- Module mocks ---
vi.mock('solid-js', () => ({
  // Minimal stub — tests do not exercise paths where signal state is read back
  createSignal: (init: unknown) => [() => init, vi.fn()],
  onCleanup: mockOnCleanup,
}))

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
  }),
}))

vi.mock('../../src/components/hexagonoids/modes/trpc.js', () => ({
  trpc: {
    sessions: {
      list: { query: mockListQuery },
      get: { query: mockGetQuery },
    },
  },
}))

vi.mock('../../src/components/hexagonoids/modes/PlaybackOverlay.js', () => ({
  PlaybackOverlay: () => null,
}))

// Stub window for keydown listener
const keydownHandlers: ((e: Partial<KeyboardEvent>) => void)[] = []
vi.stubGlobal('window', {
  addEventListener: (
    type: string,
    handler: (e: Partial<KeyboardEvent>) => void
  ) => {
    if (type === 'keydown') keydownHandlers.push(handler)
  },
  removeEventListener: vi.fn(),
})

import { PlaybackController } from '../../src/components/hexagonoids/modes/PlaybackController.js'

describe('PlaybackController', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    keydownHandlers.length = 0
  })

  afterEach(() => {
    vi.useRealTimers()
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

    PlaybackController()

    // Flush async init (list query + get query)
    await vi.advanceTimersByTimeAsync(0)

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
      { 'player-1': { left: true, right: false, thrust: true, fire: false } },
      10
    )
    expect(mockTick).toHaveBeenNthCalledWith(
      2,
      { 'player-1': { left: true, right: true, thrust: false, fire: false } },
      10
    )
  })

  it('does not tick when still loading', () => {
    // Arrange: list query returns a promise that never resolves
    mockListQuery.mockReturnValue(new Promise(() => {}))

    PlaybackController()

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

    PlaybackController()
    await vi.advanceTimersByTimeAsync(0)

    // Assert: engine was reseeded with the session seed
    expect(mockReseed).toHaveBeenCalledWith('benchmark-003', 'player-1')
  })

  it('exits playback and resets when Escape is pressed', async () => {
    // Arrange
    mockListQuery.mockResolvedValue(['benchmark-001'])
    mockGetQuery.mockResolvedValue({ frames: [{ dt: 10, i: 0 }] })

    PlaybackController()
    await vi.advanceTimersByTimeAsync(0)

    // Act: simulate Escape keydown
    const handler = keydownHandlers[0]!
    handler({ key: 'Escape', preventDefault: vi.fn() })

    // Assert: exits back to play mode
    expect(mockSetAppMode).toHaveBeenCalledWith('play')
    expect(mockReset).toHaveBeenCalled()
  })

  it('exits playback when no benchmark recordings are available', async () => {
    // Arrange: server returns seeds but none match benchmarks
    mockListQuery.mockResolvedValue(['custom-seed-xyz'])

    PlaybackController()
    await vi.advanceTimersByTimeAsync(0)

    // Assert: falls back to play mode since no benchmark seeds matched
    expect(mockSetAppMode).toHaveBeenCalledWith('play')
  })
})
