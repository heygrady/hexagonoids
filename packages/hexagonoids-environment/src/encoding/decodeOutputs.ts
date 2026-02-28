import type { PlayerInputState } from '@heygrady/hexagonoids-engine'

/**
 * Activation threshold for button presses. Above 0.5 biases the agent
 * toward inaction with random weights, reducing hard-pegged buttons.
 */
const ACTIVATION_THRESHOLD = 0.75

/**
 * Map 4 network output floats to PlayerInputState.
 * Outputs: [thrust, fire, left, right]
 */
export function decodeOutputs(outputs: ArrayLike<number>): PlayerInputState {
  return {
    thrust: (outputs[0] ?? 0) > ACTIVATION_THRESHOLD,
    fire: (outputs[1] ?? 0) > ACTIVATION_THRESHOLD,
    left: (outputs[2] ?? 0) > ACTIVATION_THRESHOLD,
    right: (outputs[3] ?? 0) > ACTIVATION_THRESHOLD,
  }
}
