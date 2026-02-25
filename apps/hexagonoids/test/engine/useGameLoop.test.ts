import { MAX_DELTA } from '@heygrady/hexagonoids-engine'
import { describe, expect, it, vi } from 'vitest'

// Capture the beforeRender callback
let beforeRenderCallback: (() => void) | null = null
const mockObserver = { id: 'mock-observer' }
const mockRemove = vi.fn()
const mockGetDeltaTime = vi.fn(() => 16.67)
const mockTick = vi.fn()

const mockScene = {
  onBeforeRenderObservable: {
    add: vi.fn((cb: () => void) => {
      beforeRenderCallback = cb
      return mockObserver
    }),
    remove: mockRemove,
  },
  getEngine: () => ({
    getDeltaTime: mockGetDeltaTime,
  }),
}

const mockEngine = {
  tick: mockTick,
}

vi.mock('solid-js', () => ({
  onCleanup: vi.fn(),
}))

vi.mock('../../src/components/solid-babylon/hooks/useScene.js', () => ({
  useScene: () => mockScene,
}))

vi.mock('@heygrady/hexagonoids-engine/solid', () => ({
  useGameState: () => mockEngine,
}))

import { useGameLoop } from '../../src/components/hexagonoids/engine/useGameLoop.js'

describe('useGameLoop', () => {
  it('calls engine.tick with inputs and clamped delta', () => {
    mockTick.mockClear()
    mockGetDeltaTime.mockReturnValue(16.67)

    const inputs = { left: true, right: false, thrust: false, fire: false }
    useGameLoop(inputs, 'player-1')

    // Simulate a frame
    beforeRenderCallback!()

    expect(mockTick).toHaveBeenCalledWith({ 'player-1': inputs }, 16.67)
  })

  it('clamps delta to MAX_DELTA for large frame hitches', () => {
    mockTick.mockClear()
    mockGetDeltaTime.mockReturnValue(200) // extreme hitch

    const inputs = { left: false, right: false, thrust: false, fire: false }
    useGameLoop(inputs, 'player-1')

    beforeRenderCallback!()

    expect(mockTick).toHaveBeenCalledWith({ 'player-1': inputs }, MAX_DELTA)
  })
})
