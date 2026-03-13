import type { AgentFn } from './types.js'

/** All inputs false — absolute floor baseline. */
export const doNothingAgent: AgentFn = () => ({
  left: false,
  right: false,
  thrust: false,
  fire: false,
})
