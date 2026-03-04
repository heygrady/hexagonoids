import type { AgentFn } from './types.js'

/** Random booleans each frame using the seeded RNG. */
export const randomAgent: AgentFn = (_state, _playerId, context) => {
  const leftVal = context.rng.gen()
  const rightVal = context.rng.gen()
  const leftActive = leftVal > 0.5
  const rightActive = rightVal > 0.5
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
    thrust: context.rng.genBool(),
    fire: context.rng.genBool(),
    left,
    right,
  }
}
