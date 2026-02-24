import { createRNG } from '@neat-evolution/utils'
import { describe, expect, it } from 'vitest'
import { randomAgent } from '../../src/agents/randomAgent.js'
import type { AgentContext } from '../../src/agents/types.js'

describe('randomAgent', () => {
  it('returns boolean inputs', () => {
    const rng = createRNG('test-seed')
    const context: AgentContext = { rng, memory: {} }

    const inputs = randomAgent(undefined as never, 'p1', context)

    expect(typeof inputs.left).toBe('boolean')
    expect(typeof inputs.right).toBe('boolean')
    expect(typeof inputs.thrust).toBe('boolean')
    expect(typeof inputs.fire).toBe('boolean')
  })

  it('produces varied inputs across ticks', () => {
    const rng = createRNG('variation-seed')
    const context: AgentContext = { rng, memory: {} }

    const results = new Set<string>()
    for (let i = 0; i < 100; i++) {
      const inputs = randomAgent(undefined as never, 'p1', context)
      results.add(JSON.stringify(inputs))
    }

    // With 100 ticks, we should see more than 1 unique combination
    expect(results.size).toBeGreaterThan(1)
  })

  it('is deterministic with the same seed', () => {
    const rng1 = createRNG('same-seed')
    const rng2 = createRNG('same-seed')
    const ctx1: AgentContext = { rng: rng1, memory: {} }
    const ctx2: AgentContext = { rng: rng2, memory: {} }

    for (let i = 0; i < 20; i++) {
      const a = randomAgent(undefined as never, 'p1', ctx1)
      const b = randomAgent(undefined as never, 'p1', ctx2)
      expect(a).toEqual(b)
    }
  })
})
