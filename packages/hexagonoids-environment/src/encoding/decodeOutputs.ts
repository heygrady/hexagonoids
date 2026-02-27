import type { PlayerInputState } from '@heygrady/hexagonoids-engine'

/**
 * Map 4 network output floats to PlayerInputState using 0.5 threshold.
 * Outputs: [thrust, fire, left, right]
 */
export function decodeOutputs(outputs: ArrayLike<number>): PlayerInputState {
  return {
    thrust: (outputs[0] ?? 0) > 0.5,
    fire: (outputs[1] ?? 0) > 0.5,
    left: (outputs[2] ?? 0) > 0.5,
    right: (outputs[3] ?? 0) > 0.5,
  }
}
