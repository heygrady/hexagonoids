import { describe, expect, it, vi } from 'vitest'

// Mock solid-js onCleanup to capture the cleanup callback
vi.mock('solid-js', () => ({
  onCleanup: vi.fn(),
}))

// Mock window.addEventListener/removeEventListener to capture handlers
const listeners = new Map<string, EventListenerOrEventListenerObject>()
vi.stubGlobal('window', {
  addEventListener: vi.fn(
    (type: string, handler: EventListenerOrEventListenerObject) => {
      listeners.set(type, handler)
    }
  ),
  removeEventListener: vi.fn(),
})

import { useInputBridge } from '../../src/components/hexagonoids/engine/useInputBridge.js'

function fireKey(type: 'keydown' | 'keyup', key: string) {
  const handler = listeners.get(type)
  if (typeof handler === 'function') {
    handler({ key } as KeyboardEvent)
  }
}

describe('useInputBridge', () => {
  it('returns all-false inputs initially', () => {
    const inputs = useInputBridge()

    expect(inputs).toEqual({
      left: false,
      right: false,
      thrust: false,
      fire: false,
    })
  })

  it('sets left flag on ArrowLeft keydown and clears on keyup', () => {
    const inputs = useInputBridge()

    fireKey('keydown', 'ArrowLeft')
    expect(inputs.left).toBe(true)

    fireKey('keyup', 'ArrowLeft')
    expect(inputs.left).toBe(false)
  })

  it('maps WASD keys to correct input flags', () => {
    const inputs = useInputBridge()

    fireKey('keydown', 'a')
    expect(inputs.left).toBe(true)

    fireKey('keydown', 'd')
    expect(inputs.right).toBe(true)

    fireKey('keydown', 'w')
    expect(inputs.thrust).toBe(true)

    fireKey('keydown', 's')
    expect(inputs.fire).toBe(true)
  })

  it('maps Space to fire', () => {
    const inputs = useInputBridge()

    fireKey('keydown', ' ')
    expect(inputs.fire).toBe(true)

    fireKey('keyup', ' ')
    expect(inputs.fire).toBe(false)
  })
})
