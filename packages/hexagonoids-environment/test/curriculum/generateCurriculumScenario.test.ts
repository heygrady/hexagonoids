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
    expect(player).toBeDefined()
    expect(player!.shipId).toBeTruthy()
    const ship = engine.state.ships.get(player!.shipId!)
    expect(ship).toBeDefined()
    expect(ship!.alive).toBe(true)
  })

  it('wave spawning is suppressed', () => {
    const { engine } = createCurriculumGameState(makeParams(), 'test-seed', 33)
    const player = engine.state.players.get(PLAYER_ID)
    expect(player!.nextWaveCheckAt).toBe(engine.state.now + 999999)
    expect(player!.lastRockEncounterAt).toBe(engine.state.now)
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
    const ship = engine.state.ships.get(player!.shipId!)!
    const rock = [...engine.state.rocks.values()][0]!

    // Compute angular distance between ship and rock
    const dot =
      (ship.x ?? 0) * (rock.x ?? 0) +
      (ship.y ?? 1) * (rock.y ?? 0) +
      (ship.z ?? 0) * (rock.z ?? 0)
    const angularDist = Math.acos(Math.max(-1, Math.min(1, dot)))

    // Should be approximately SOI_ANGULAR_RADIUS (~0.5 rad)
    expect(angularDist).toBeGreaterThan(0.3)
    expect(angularDist).toBeLessThan(0.7)
  })

  it('produces different states for different seeds', () => {
    const a = createCurriculumGameState(makeParams(), 'seed-a', 33)
    const b = createCurriculumGameState(makeParams(), 'seed-b', 33)

    // Ships should be at different positions (seeded random spawn)
    const shipA = [...a.engine.state.ships.values()][0]!
    const shipB = [...b.engine.state.ships.values()][0]!

    const dot =
      (shipA.x ?? 0) * (shipB.x ?? 0) +
      (shipA.y ?? 1) * (shipB.y ?? 1) +
      (shipA.z ?? 0) * (shipB.z ?? 0)

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
      const rock = [...engine.state.rocks.values()][0]!
      expect(rock.size).toBe(rockSize)
    }
  })
})
