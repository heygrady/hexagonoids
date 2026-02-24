import type { AgentFn } from './types.js'

/** Random booleans each frame using the seeded RNG. */
export const randomAgent: AgentFn = (_state, _playerId, context) => ({
  left: context.rng.genBool(),
  right: context.rng.genBool(),
  thrust: context.rng.genBool(),
  fire: context.rng.genBool(),
})
