import type { PlayerInputState } from '@heygrady/hexagonoids-engine'
import { createContext, onCleanup, useContext } from 'solid-js'

export interface InputBridge extends PlayerInputState {
  reset(): void
}

const InputBridgeContext = createContext<InputBridge>()

/** Access the shared input bridge to reset inputs (e.g. after starting a game). */
export const useInputs = (): InputBridge => {
  const ctx = useContext(InputBridgeContext)
  if (ctx == null) {
    throw new Error('useInputs: must be inside InputBridgeContext.Provider')
  }
  return ctx
}

export { InputBridgeContext }

/**
 * Bridges keyboard events to PlayerInputState for the engine.
 * Uses a plain mutable object since inputs are read synchronously
 * in beforeRender (not in a reactive context).
 *
 * Key mapping matches KeyboardPlayer.tsx:
 * - Left: a, A, ArrowLeft
 * - Right: d, D, ArrowRight
 * - Thrust: w, W, ArrowUp
 * - Fire: s, S, ArrowDown, Space
 */
export function useInputBridge(): InputBridge {
  const inputs: InputBridge = {
    left: false,
    right: false,
    thrust: false,
    fire: false,
    reset() {
      inputs.left = false
      inputs.right = false
      inputs.thrust = false
      inputs.fire = false
    },
  }

  function onKeyDown(e: KeyboardEvent) {
    const key = e.key
    if (key === 'a' || key === 'A' || key === 'ArrowLeft') inputs.left = true
    else if (key === 'd' || key === 'D' || key === 'ArrowRight')
      inputs.right = true
    else if (key === 'w' || key === 'W' || key === 'ArrowUp')
      inputs.thrust = true
    else if (key === 's' || key === 'S' || key === 'ArrowDown' || key === ' ')
      inputs.fire = true
    else return
    e.preventDefault()
  }

  function onKeyUp(e: KeyboardEvent) {
    const key = e.key
    if (key === 'a' || key === 'A' || key === 'ArrowLeft') inputs.left = false
    else if (key === 'd' || key === 'D' || key === 'ArrowRight')
      inputs.right = false
    else if (key === 'w' || key === 'W' || key === 'ArrowUp')
      inputs.thrust = false
    else if (key === 's' || key === 'S' || key === 'ArrowDown' || key === ' ')
      inputs.fire = false
    else return
    e.preventDefault()
  }

  window.addEventListener('keydown', onKeyDown)
  window.addEventListener('keyup', onKeyUp)
  onCleanup(() => {
    window.removeEventListener('keydown', onKeyDown)
    window.removeEventListener('keyup', onKeyUp)
  })

  return inputs
}
