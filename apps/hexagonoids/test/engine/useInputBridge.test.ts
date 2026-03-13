import { createRoot } from 'solid-js'
import { afterEach, describe, expect, it } from 'vitest'

import { useInputBridge } from '../../src/components/hexagonoids/engine/useInputBridge.js'

let dispose: (() => void) | null = null

afterEach(() => {
  dispose?.()
  dispose = null
})

function setupInputs(): ReturnType<typeof useInputBridge> {
  let inputs: ReturnType<typeof useInputBridge> | undefined
  createRoot((rootDispose) => {
    dispose = rootDispose
    inputs = useInputBridge()
  })
  if (inputs == null) {
    throw new Error('Expected useInputBridge to initialize')
  }
  return inputs
}

describe('useInputBridge', () => {
  it('returns all-false inputs initially', () => {
    const inputs = setupInputs()

    expect(inputs).toMatchObject({
      left: false,
      right: false,
      thrust: false,
      fire: false,
    })
  })

  it('sets left flag on ArrowLeft keydown and clears on keyup', () => {
    const inputs = setupInputs()

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft' }))
    expect(inputs.left).toBe(true)

    window.dispatchEvent(new KeyboardEvent('keyup', { key: 'ArrowLeft' }))
    expect(inputs.left).toBe(false)
  })

  it('maps WASD keys to correct input flags', () => {
    const inputs = setupInputs()

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'a' }))
    expect(inputs.left).toBe(true)

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'd' }))
    expect(inputs.right).toBe(true)

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'w' }))
    expect(inputs.thrust).toBe(true)

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 's' }))
    expect(inputs.fire).toBe(true)
  })

  it('maps Space to fire', () => {
    const inputs = setupInputs()

    window.dispatchEvent(new KeyboardEvent('keydown', { key: ' ' }))
    expect(inputs.fire).toBe(true)

    window.dispatchEvent(new KeyboardEvent('keyup', { key: ' ' }))
    expect(inputs.fire).toBe(false)
  })

  it('removes listeners on dispose', () => {
    const inputs = setupInputs()

    dispose?.()
    dispose = null

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft' }))
    expect(inputs.left).toBe(false)
  })
})
