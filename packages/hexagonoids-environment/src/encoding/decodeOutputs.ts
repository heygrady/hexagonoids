import type { PlayerInputState } from '@heygrady/hexagonoids-engine'

/**
 * Activation threshold for button presses. Above 0.5 biases the agent
 * toward inaction with random weights, reducing hard-pegged buttons.
 */
const ACTIVATION_THRESHOLD = 0.75

/**
 * Map 4 network output floats to PlayerInputState.
 * Outputs: [thrust, fire, left, right]
 *
 * When both left and right exceed the threshold, only the stronger
 * signal wins — pressing both simultaneously cancels out in the engine,
 * so we pick the dominant direction instead.
 */
export function decodeOutputs(outputs: ArrayLike<number>): PlayerInputState {
  const leftVal = outputs[2] ?? 0
  const rightVal = outputs[3] ?? 0
  const leftActive = leftVal > ACTIVATION_THRESHOLD
  const rightActive = rightVal > ACTIVATION_THRESHOLD
  let left: boolean
  let right: boolean
  if (leftActive && rightActive) {
    left = leftVal >= rightVal
    right = rightVal > leftVal
  } else {
    left = leftActive
    right = rightActive
  }

  return {
    thrust: (outputs[0] ?? 0) > ACTIVATION_THRESHOLD,
    fire: (outputs[1] ?? 0) > ACTIVATION_THRESHOLD,
    left,
    right,
  }
}
