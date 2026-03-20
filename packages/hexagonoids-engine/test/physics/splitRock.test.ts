import { createRNG } from '@neat-evolution/utils'
import { describe, expect, it } from 'vitest'
import { vec3Length } from '../../src/features/engine/math/vec3.js'
import {
  createGame,
  ROCK_LARGE_SIZE,
  ROCK_MEDIUM_SIZE,
  spawnRock,
  splitRock,
} from '../../src/index.js'
import { pointFromLatLng } from '../helpers/points.js'

describe('splitRock scalar math', () => {
  it('creates two child rocks with valid positions', () => {
    const rng = createRNG('split-test')
    const game = createGame({ seed: 'split-test' }).state
    const point = pointFromLatLng(10, 20)
    const rock = spawnRock(game, point, ROCK_LARGE_SIZE, rng)

    const beforeCount = game.rocks.size
    splitRock(game, rock, rng)

    // Parent destroyed, two children created
    expect(game.rocks.size).toBe(beforeCount + 1) // -1 parent + 2 children
    expect(game.rocks.has(rock.id)).toBe(false)
  })

  it('child rocks have valid unit-sphere positions', () => {
    const rng = createRNG('position-test')
    const game = createGame({ seed: 'position-test' }).state
    const rock = spawnRock(game, pointFromLatLng(30, -45), ROCK_LARGE_SIZE, rng)
    splitRock(game, rock, rng)

    for (const child of game.rocks.values()) {
      const len = vec3Length(child.position)
      expect(len).toBeCloseTo(1, 5)
    }
  })

  it('child rocks have non-zero angular velocity', () => {
    const rng = createRNG('velocity-test')
    const game = createGame({ seed: 'velocity-test' }).state
    const rock = spawnRock(
      game,
      pointFromLatLng(0, 0),
      ROCK_LARGE_SIZE,
      rng,
      Math.PI / 4
    )
    splitRock(game, rock, rng)

    for (const child of game.rocks.values()) {
      const speed = vec3Length(child.angularVelocity)
      expect(speed).toBeGreaterThan(0.001)
    }
  })

  it('child rocks are smaller than parent', () => {
    const rng = createRNG('size-test')
    const game = createGame({ seed: 'size-test' }).state
    const rock = spawnRock(game, pointFromLatLng(0, 90), ROCK_LARGE_SIZE, rng)
    splitRock(game, rock, rng)

    for (const child of game.rocks.values()) {
      expect(child.size).toBe(ROCK_MEDIUM_SIZE)
    }
  })

  it('small rocks are destroyed without children', () => {
    const rng = createRNG('destroy-test')
    const game = createGame({ seed: 'destroy-test' }).state
    const rock = spawnRock(game, pointFromLatLng(0, 0), 0 as 0 | 1 | 2, rng)
    const id = rock.id
    splitRock(game, rock, rng)

    expect(game.rocks.has(id)).toBe(false)
    expect(game.rocks.size).toBe(0)
  })

  it('produces deterministic results with same seed', () => {
    const results: Array<{
      x: number
      y: number
      z: number
    }> = []

    for (let run = 0; run < 2; run++) {
      const rng = createRNG('deterministic-test')
      const game = createGame({ seed: 'deterministic-test' }).state
      const rock = spawnRock(
        game,
        pointFromLatLng(15, -30),
        ROCK_LARGE_SIZE,
        rng
      )
      splitRock(game, rock, rng)

      const children = [...game.rocks.values()]
      for (const child of children) {
        results.push({
          x: child.position[0],
          y: child.position[1],
          z: child.position[2],
        })
      }
    }

    // Two runs should produce identical children
    expect(results[0]).toEqual(results[2])
    expect(results[1]).toEqual(results[3])
  })
})
