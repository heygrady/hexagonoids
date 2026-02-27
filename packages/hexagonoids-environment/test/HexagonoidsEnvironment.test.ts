import type {
  BatchInputs,
  BatchOutputs,
  Inputs,
  Outputs,
  SyncExecutor,
} from '@neat-evolution/executor'
import { describe, expect, it } from 'vitest'
import { createEnvironment } from '../src/createEnvironment.js'
import { INPUT_COUNT } from '../src/encoding/encodeGameState.js'
import { HexagonoidsEnvironment } from '../src/HexagonoidsEnvironment.js'

/** A trivial SyncExecutor that returns 0.5 for all outputs. */
function createMidpointExecutor(): SyncExecutor {
  return {
    isAsync: false,
    execute(_inputs: Inputs): Outputs {
      return new Array(4).fill(0.5)
    },
    executeBatch(batch: BatchInputs): BatchOutputs {
      return batch.map((_inputs) => new Array(4).fill(0.5))
    },
  }
}

/** A SyncExecutor that returns pseudo-random outputs. */
function createRandomExecutor(): SyncExecutor {
  let i = 0
  return {
    isAsync: false,
    execute(_inputs: Inputs): Outputs {
      i++
      return [
        Math.sin(i * 1.1) * 0.5 + 0.5,
        Math.sin(i * 2.3) * 0.5 + 0.5,
        Math.sin(i * 3.7) * 0.5 + 0.5,
        Math.sin(i * 4.1) * 0.5 + 0.5,
      ]
    },
    executeBatch(batch: BatchInputs): BatchOutputs {
      return batch.map((_inputs) => {
        i++
        return [
          Math.sin(i * 1.1) * 0.5 + 0.5,
          Math.sin(i * 2.3) * 0.5 + 0.5,
          Math.sin(i * 3.7) * 0.5 + 0.5,
          Math.sin(i * 4.1) * 0.5 + 0.5,
        ]
      })
    },
  }
}

describe('HexagonoidsEnvironment', () => {
  it('has correct description', () => {
    const env = new HexagonoidsEnvironment()
    expect(env.description).toEqual({ inputs: INPUT_COUNT, outputs: 4 })
  })

  it('isAsync is false', () => {
    const env = new HexagonoidsEnvironment()
    expect(env.isAsync).toBe(false)
  })

  it('evaluate returns a number', () => {
    const env = new HexagonoidsEnvironment({
      simulation: { maxTicks: 100, dtMs: 33, useFastThrust: true },
    })
    const executor = createMidpointExecutor()
    const result = env.evaluate(executor)
    expect(typeof result).toBe('number')
    expect(Number.isFinite(result)).toBe(true)
  })

  it('same seed + same executor produces same result (determinism)', () => {
    const env = new HexagonoidsEnvironment({
      simulation: { maxTicks: 100, dtMs: 33, useFastThrust: true },
    })
    // Use a fake RNG that returns the same value to produce identical seeds
    const makeRng = () => {
      return {
        gen: () => 0.42,
        genRange: (min: number, _max: number) => min,
        genBool: () => true,
      }
    }
    const executor1 = createMidpointExecutor()
    const executor2 = createMidpointExecutor()
    const result1 = env.evaluate(executor1, makeRng())
    const result2 = env.evaluate(executor2, makeRng())
    expect(result1).toBe(result2)
  })

  it('evaluateBatch returns array of numbers', () => {
    const env = new HexagonoidsEnvironment({
      simulation: { maxTicks: 50, dtMs: 33, useFastThrust: true },
    })
    const executors = [createMidpointExecutor(), createRandomExecutor()]
    const results = env.evaluateBatch(executors)
    expect(results).toHaveLength(2)
    for (const r of results) {
      expect(typeof r).toBe('number')
    }
  })

  it('evaluateAsync throws', async () => {
    const env = new HexagonoidsEnvironment()
    await expect(env.evaluateAsync(createMidpointExecutor())).rejects.toThrow(
      'evaluateAsync is not implemented'
    )
  })

  it('evaluateBatchAsync throws', async () => {
    const env = new HexagonoidsEnvironment()
    await expect(
      env.evaluateBatchAsync([createMidpointExecutor()])
    ).rejects.toThrow('evaluateBatchAsync is not implemented')
  })

  it('toFactoryOptions → createEnvironment round-trip', () => {
    const env = new HexagonoidsEnvironment({
      simulation: { maxTicks: 200, dtMs: 33, useFastThrust: true },
    })
    const options = env.toFactoryOptions()
    const env2 = createEnvironment(options)
    expect(env2.description).toEqual(env.description)
    expect(env2.toFactoryOptions()).toEqual(options)
  })

  it('createEnvironment with undefined uses defaults', () => {
    const env = createEnvironment(undefined)
    expect(env.description).toEqual({ inputs: INPUT_COUNT, outputs: 4 })
    expect(typeof env.evaluate(createMidpointExecutor())).toBe('number')
  })
})
