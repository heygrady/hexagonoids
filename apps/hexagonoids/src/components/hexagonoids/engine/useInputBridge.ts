import type { PlayerInputState } from '@heygrady/hexagonoids-engine'
import { onCleanup } from 'solid-js'

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
export function useInputBridge(): PlayerInputState {
  const inputs: PlayerInputState = {
    left: false,
    right: false,
    thrust: false,
    fire: false,
  }

  function onKeyDown(e: KeyboardEvent) {
    const key = e.key
    if (key === 'a' || key === 'A' || key === 'ArrowLeft') inputs.left = true
    if (key === 'd' || key === 'D' || key === 'ArrowRight') inputs.right = true
    if (key === 'w' || key === 'W' || key === 'ArrowUp') inputs.thrust = true
    if (key === 's' || key === 'S' || key === 'ArrowDown' || key === ' ')
      inputs.fire = true
  }

  function onKeyUp(e: KeyboardEvent) {
    const key = e.key
    if (key === 'a' || key === 'A' || key === 'ArrowLeft') inputs.left = false
    if (key === 'd' || key === 'D' || key === 'ArrowRight') inputs.right = false
    if (key === 'w' || key === 'W' || key === 'ArrowUp') inputs.thrust = false
    if (key === 's' || key === 'S' || key === 'ArrowDown' || key === ' ')
      inputs.fire = false
  }

  window.addEventListener('keydown', onKeyDown)
  window.addEventListener('keyup', onKeyUp)
  onCleanup(() => {
    window.removeEventListener('keydown', onKeyDown)
    window.removeEventListener('keyup', onKeyUp)
  })

  return inputs
}
