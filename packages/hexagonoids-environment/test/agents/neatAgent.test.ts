import {
  createGame,
  spawnRock,
  startPlayer,
} from '@heygrady/hexagonoids-engine'
import { describe, expect, it } from 'vitest'
import { neatAgent } from '../../src/agents/neatAgent.js'
import type { AgentContext } from '../../src/agents/types.js'
import { encodeGameState } from '../../src/encoding/encodeGameState.js'

const PLAYER_ID = 'player-1'

function setupGame(seed: string) {
  const engine = createGame({ seed })
  const { state, rng } = engine
  startPlayer(state, PLAYER_ID, rng)
  return { state, engine }
}

function createFixedRng(value = 0.5) {
  return {
    gen: () => value,
    genRange: (min: number, max: number) => min + (max - min) * value,
    genBool: () => value >= 0.5,
  }
}

function createCapturingExecutor(onExecute: (inputs: number[]) => void) {
  return {
    isAsync: false as const,
    execute(inputs: ArrayLike<number>) {
      const values = Array.from(inputs)
      onExecute(values)
      return [0, 0, 0, 0]
    },
    executeBatch(batch: ArrayLike<ArrayLike<number>>) {
      return Array.from(batch, (inputs) => this.execute(inputs))
    },
  }
}

describe('neatAgent', () => {
  it('adds only a small proximity floor to empty lidar rays', () => {
    const { state, engine } = setupGame('neat-agent-empty-noise')
    let capturedInputs: number[] | undefined
    const context: AgentContext = {
      rng: createFixedRng(),
      memory: {},
      executor: createCapturingExecutor((inputs) => {
        capturedInputs = inputs
      }),
      spatialQueries: engine,
    }

    neatAgent(state, PLAYER_ID, context)

    expect(capturedInputs).toBeDefined()
    for (let ray = 0; ray < 16; ray++) {
      const base = 5 + ray * 4
      expect(capturedInputs?.[base]).toBe(0.015)
      expect(capturedInputs?.[base + 1]).toBe(0)
      expect(capturedInputs?.[base + 2]).toBe(0)
      expect(capturedInputs?.[base + 3]).toBe(0)
    }
  })

  it('does not modify populated lidar rays', () => {
    const { state, engine } = setupGame('neat-agent-preserve-hits')
    const player = state.players.get(PLAYER_ID)
    const ship =
      player?.shipId != null ? state.ships.get(player.shipId) : undefined
    if (ship == null || !ship.alive) {
      throw new Error('Expected alive ship for neatAgent test')
    }

    spawnRock(state, ship.lat, ship.lng + 4, 2, createFixedRng())

    const rawInputs = encodeGameState(
      state,
      PLAYER_ID,
      new Map(),
      new Map(),
      33,
      undefined,
      undefined,
      undefined,
      undefined,
      engine
    )
    let capturedInputs: number[] | undefined
    const context: AgentContext = {
      rng: createFixedRng(),
      memory: {},
      executor: createCapturingExecutor((inputs) => {
        capturedInputs = inputs
      }),
      spatialQueries: engine,
    }

    neatAgent(state, PLAYER_ID, context)

    expect(capturedInputs).toBeDefined()
    for (let ray = 0; ray < 16; ray++) {
      const base = 5 + ray * 4
      const rawProximity = rawInputs[base] ?? 0
      const rawClosing = rawInputs[base + 1] ?? 0
      const rawRockSize = rawInputs[base + 2] ?? 0
      const rawBearingOffset = rawInputs[base + 3] ?? 0

      if (rawProximity > 0 || rawRockSize > 0 || rawBearingOffset !== 0) {
        expect(capturedInputs?.[base]).toBe(rawProximity)
        expect(capturedInputs?.[base + 1]).toBe(rawClosing)
        expect(capturedInputs?.[base + 2]).toBe(rawRockSize)
        expect(capturedInputs?.[base + 3]).toBe(rawBearingOffset)
      }
    }
  })
})
