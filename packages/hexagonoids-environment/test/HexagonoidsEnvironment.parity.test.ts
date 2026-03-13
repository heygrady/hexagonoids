import type { EpisodicAgent } from '@neat-evolution/environment'
import type {
  BatchInputs,
  BatchOutputs,
  Inputs,
  Outputs,
  SyncExecutor,
} from '@neat-evolution/executor'
import type { RNG } from '@neat-evolution/utils'
import { describe, expect, it } from 'vitest'

import { HexagonoidsEnvironment } from '../src/HexagonoidsEnvironment.js'

describe('HexagonoidsEnvironment parity', () => {
  const simulationOverrides = {
    curriculumEnabled: false,
    curriculumCount: 0,
    scenariosPerOrganism: 0,
    scenarioMaxTicks: 16,
  }

  const createMidpointExecutor = (): SyncExecutor => ({
    isAsync: false,
    execute(_inputs: Inputs): Outputs {
      return new Array(4).fill(0.5)
    },
    executeBatch(batch: BatchInputs): BatchOutputs {
      return batch.map(() => new Array(4).fill(0.5))
    },
  })

  class ExecutorBackedAgent implements EpisodicAgent {
    constructor(private readonly executor: SyncExecutor) {}

    act(inputs: Float64Array): Float64Array {
      const outputs = this.executor.execute(Array.from(inputs))
      return Float64Array.from(outputs)
    }

    reward(): void {
      // no-op for deterministic parity verification
    }

    startEpisode(): void {
      // no-op
    }

    endEpisode(): void {
      // no-op
    }
  }

  const createAgentSeedRng = (): RNG => {
    let next = 0
    return {
      gen: () => `agent-${next++}` as unknown as number,
      genRange: (min: number) => min,
      genBool: () => true,
    }
  }

  it('produces matching fitness for executor and agent evaluation when seeds align', () => {
    const environment = new HexagonoidsEnvironment({
      simulation: {
        maxTicks: 128,
        dtMs: 33,
        useFastThrust: true,
        ...simulationOverrides,
      },
      scenarioWeight: 0,
      curriculumWeight: 0,
      fullGameWeight: 1,
      fullGameSeedsPerOrganism: 1,
    })

    const executor = createMidpointExecutor()
    const agent = new ExecutorBackedAgent(executor)
    const rng = createAgentSeedRng()

    const executorFitness = environment.evaluate(executor, rng)
    const agentFitness = environment.evaluateAgent(agent)

    expect(executorFitness).toBeCloseTo(agentFitness, 10)
  })
})
