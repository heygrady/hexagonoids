import type {
  BatchInputs,
  BatchOutputs,
  Inputs,
  Outputs,
  StaticExecutor,
} from '@neat-evolution/executor'
import { createVanillaStepAgent } from '@neat-evolution/rl-core'
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

  const createMidpointExecutor = (): StaticExecutor => ({
    forward(_inputs: Inputs): Outputs {
      return new Array(4).fill(0.5)
    },
    forwardBatch(batch: BatchInputs): BatchOutputs {
      return batch.map(() => new Array(4).fill(0.5))
    },
  })

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
    const agent = createVanillaStepAgent(executor)
    const rng = createAgentSeedRng()

    const executorFitness = environment.evaluate(executor, { rng })
    const agentFitness = environment.evaluateStepAgent(agent)

    expect(executorFitness).toBeCloseTo(agentFitness, 10)
  })
})
