import { describe, expect, it } from 'vitest'
import {
  ALL_DISTANCE_CLASSES,
  ALL_PATTERNS,
  type CurriculumScenarioParams,
  createCurriculumGameState,
  isValidPatternDistance,
} from '../../src/curriculum/generateCurriculumScenario.js'
import { SOI_ANGULAR_RADIUS } from '../../src/utils/constants.js'

const PLAYER_ID = 'player-1'

function makeParams(
  overrides: Partial<CurriculumScenarioParams> = {}
): CurriculumScenarioParams {
  return {
    angle: 0,
    pattern: 'inbound',
    rockSize: 2,
    headingJitter: 0,
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

  it('rock is within SOI for far distance inbound pattern', () => {
    const { engine } = createCurriculumGameState(
      makeParams({ pattern: 'inbound', distance: 'far' }),
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

    // 'far' = 60-100% of SOI_ANGULAR_RADIUS
    expect(angularDist).toBeGreaterThan(SOI_ANGULAR_RADIUS * 0.5)
    expect(angularDist).toBeLessThan(SOI_ANGULAR_RADIUS * 1.1)
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

  it('works for all patterns', () => {
    for (const pattern of ALL_PATTERNS) {
      const { engine, maxTicks } = createCurriculumGameState(
        makeParams({ pattern }),
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

  it('works for various angles around the ship', () => {
    for (let i = 0; i < 12; i++) {
      const angle = (i / 12) * 2 * Math.PI
      const { engine, maxTicks } = createCurriculumGameState(
        makeParams({ angle }),
        'test-seed',
        33
      )
      expect(engine.state.rocks.size).toBe(1)
      expect(maxTicks).toBeGreaterThan(0)
    }
  })

  it('spawns multiple rocks when rockCount > 1', () => {
    for (const rockCount of [2, 3, 4, 5]) {
      const { engine } = createCurriculumGameState(
        makeParams({ rockCount, secondarySpread: 0.26 }),
        'test-seed',
        33
      )
      expect(engine.state.rocks.size).toBe(rockCount)
    }
  })

  it('multi-rock scenarios have larger tick budget than single-rock at close distance', () => {
    // Use close + small rock to stay under the 256-tick cap
    const single = createCurriculumGameState(
      makeParams({ pattern: 'outbound', distance: 'close', rockSize: 0 }),
      'test-seed',
      33
    )
    const multi = createCurriculumGameState(
      makeParams({
        pattern: 'outbound',
        distance: 'close',
        rockSize: 0,
        rockCount: 3,
        secondarySpread: 0.26,
      }),
      'test-seed',
      33
    )
    expect(multi.maxTicks).toBeGreaterThan(single.maxTicks)
  })

  it('multi-rock works for all patterns', () => {
    for (const pattern of ALL_PATTERNS) {
      const { engine, maxTicks } = createCurriculumGameState(
        makeParams({ pattern, rockCount: 3, secondarySpread: 1.57 }),
        'test-seed',
        33
      )
      expect(engine.state.rocks.size).toBe(3)
      expect(maxTicks).toBeGreaterThan(0)
    }
  })

  it('works for all valid pattern × distance combinations', () => {
    for (const pattern of ALL_PATTERNS) {
      for (const distance of ALL_DISTANCE_CLASSES) {
        if (!isValidPatternDistance(pattern, distance)) continue
        const { engine, maxTicks } = createCurriculumGameState(
          makeParams({ pattern, distance }),
          'test-seed',
          33
        )
        expect(engine.state.rocks.size).toBe(1)
        expect(maxTicks).toBeGreaterThan(0)
      }
    }
  })

  it('close distance rocks spawn nearer than far distance rocks', () => {
    // Use outbound pattern which supports both close and mid
    const closeResult = createCurriculumGameState(
      makeParams({ pattern: 'outbound', distance: 'close' }),
      'fixed-seed',
      33
    )
    const midResult = createCurriculumGameState(
      makeParams({ pattern: 'outbound', distance: 'mid' }),
      'fixed-seed',
      33
    )

    // close should have smaller tick budget (less travel time)
    expect(closeResult.maxTicks).toBeLessThanOrEqual(midResult.maxTicks)
  })

  it('beyond distance rocks spawn outside SOI', () => {
    const { engine } = createCurriculumGameState(
      makeParams({ pattern: 'inbound', distance: 'beyond' }),
      'test-seed',
      33
    )
    const player = engine.state.players.get(PLAYER_ID)
    if (player === undefined || player.shipId == null) {
      throw new Error('Expected player')
    }
    const ship = engine.state.ships.get(player.shipId)
    if (ship === undefined) {
      throw new Error('Expected ship')
    }
    const rock = [...engine.state.rocks.values()][0]
    if (rock === undefined) {
      throw new Error('Expected rock')
    }

    const dot =
      ship.position[0] * rock.position[0] +
      ship.position[1] * rock.position[1] +
      ship.position[2] * rock.position[2]
    const angularDist = Math.acos(Math.max(-1, Math.min(1, dot)))

    // 'beyond' = 100-130% of SOI
    expect(angularDist).toBeGreaterThan(SOI_ANGULAR_RADIUS * 0.95)
  })
})
