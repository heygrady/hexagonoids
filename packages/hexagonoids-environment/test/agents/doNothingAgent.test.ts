import { createRNG } from '@neat-evolution/utils'
import { describe, expect, it } from 'vitest'
import { doNothingAgent } from '../../src/agents/doNothingAgent.js'
import type { AgentContext } from '../../src/agents/types.js'

describe('doNothingAgent', () => {
  it('returns all false inputs', () => {
    const rng = createRNG('test')
    const context: AgentContext = { rng, memory: {} }
    // State doesn't matter for doNothingAgent
    const inputs = doNothingAgent(undefined as never, 'p1', context)

    expect(inputs).toEqual({
      left: false,
      right: false,
      thrust: false,
      fire: false,
    })
  })

  it('always returns the same output regardless of state', () => {
    const rng = createRNG('test')
    const context: AgentContext = { rng, memory: {} }

    const result1 = doNothingAgent(undefined as never, 'p1', context)
    const result2 = doNothingAgent(undefined as never, 'p2', context)

    expect(result1).toEqual(result2)
  })
})
