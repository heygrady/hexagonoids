import { describe, expect, it } from 'vitest'
import type { CurriculumScenarioParams } from '../../src/curriculum/generateCurriculumScenario.js'
import { createCurriculumGameState } from '../../src/curriculum/generateCurriculumScenario.js'

const PLAYER_ID = 'player-1'

function makeParams(
  overrides: Partial<CurriculumScenarioParams> = {}
): CurriculumScenarioParams {
  return {
    coneIndex: 0,
    variant: 'direct-towards',
    rockSize: 2,
    lateralOffset: 0,
    ...overrides,
  }
}

describe('createCurriculumGameState', () => {
  it('creates a game state with exactly 1 rock', () => {
    const { engine } = createCurriculumGameState(makeParams(), 'test-seed', 33)
    expect(engine.state.rocks.size).toBe(1)
  })

  it('has a player with a ship', () => {
    const { engine } = createCurriculumGameState(makeParams(), 'test-seed', 33)
    const player = engine.state.players.get(PLAYER_ID)
    if (player === undefined) {
      throw new Error('Expected player to be defined')
    }
    if (player.shipId == null) {
      throw new Error('Expected player to have a shipId')
    }
    const ship = engine.state.ships.get(player.shipId)
    if (ship === undefined) {
      throw new Error('Expected ship to be defined')
    }
    expect(ship.alive).toBe(true)
  })

  it('wave spawning is suppressed', () => {
    const { engine } = createCurriculumGameState(makeParams(), 'test-seed', 33)
    const player = engine.state.players.get(PLAYER_ID)
    if (player === undefined) {
      throw new Error('Expected player to be defined')
    }
    expect(player.nextWaveCheckAt).toBe(engine.state.now + 999999)
    expect(player.lastRockEncounterAt).toBe(engine.state.now)
  })

  it('maxTicks is positive and finite', () => {
    const { maxTicks } = createCurriculumGameState(
      makeParams(),
      'test-seed',
      33
    )
    expect(maxTicks).toBeGreaterThan(0)
    expect(Number.isFinite(maxTicks)).toBe(true)
  })

  it('rock is near SOI edge for direct-towards variant', () => {
    const { engine } = createCurriculumGameState(
      makeParams({ variant: 'direct-towards' }),
      'test-seed',
      33
    )
    const player = engine.state.players.get(PLAYER_ID)
    if (player === undefined || player.shipId == null) {
      throw new Error('Expected player with shipId to be defined')
    }
    const ship = engine.state.ships.get(player.shipId)
    if (ship === undefined) {
      throw new Error('Expected ship to be defined')
    }
    const rock = [...engine.state.rocks.values()][0]
    if (rock === undefined) {
      throw new Error('Expected rock to be defined')
    }

    // Compute angular distance between ship and rock
    const dot =
      ship.position[0] * rock.position[0] +
      ship.position[1] * rock.position[1] +
      ship.position[2] * rock.position[2]
    const angularDist = Math.acos(Math.max(-1, Math.min(1, dot)))

    // Should be approximately SOI_ANGULAR_RADIUS (~0.5 rad)
    expect(angularDist).toBeGreaterThan(0.3)
    expect(angularDist).toBeLessThan(0.7)
  })

  it('produces different states for different seeds', () => {
    const a = createCurriculumGameState(makeParams(), 'seed-a', 33)
    const b = createCurriculumGameState(makeParams(), 'seed-b', 33)

    // Ships should be at different positions (seeded random spawn)
    const shipA = [...a.engine.state.ships.values()][0]
    if (shipA === undefined) {
      throw new Error('Expected shipA to be defined')
    }
    const shipB = [...b.engine.state.ships.values()][0]
    if (shipB === undefined) {
      throw new Error('Expected shipB to be defined')
    }

    const dot =
      shipA.position[0] * shipB.position[0] +
      shipA.position[1] * shipB.position[1] +
      shipA.position[2] * shipB.position[2]

    // Different seeds should produce different positions (not exactly the same)
    expect(dot).not.toBeCloseTo(1.0, 5)
  })

  it('works for all variants', () => {
    const variants = [
      'direct-towards',
      'direct-away',
      'lateral-left',
      'lateral-right',
    ] as const
    for (const variant of variants) {
      const { engine, maxTicks } = createCurriculumGameState(
        makeParams({ variant }),
        'test-seed',
        33
      )
      expect(engine.state.rocks.size).toBe(1)
      expect(maxTicks).toBeGreaterThan(0)
    }
  })

  it('works for all rock sizes', () => {
    for (const rockSize of [0, 1, 2] as const) {
      const { engine } = createCurriculumGameState(
        makeParams({ rockSize }),
        'test-seed',
        33
      )
      const rock = [...engine.state.rocks.values()][0]
      if (rock === undefined) {
        throw new Error('Expected rock to be defined')
      }
      expect(rock.size).toBe(rockSize)
    }
  })
})
