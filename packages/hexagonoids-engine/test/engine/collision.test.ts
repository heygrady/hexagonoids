import type { RNG } from '@neat-evolution/utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { EngineHooks, GameState } from '../../src/index.js'
import {
  advanceGameTime,
  type CollisionPair,
  createGame,
  detectCollisions,
  greatCircleDistance,
  handleCollisions,
  RADIUS,
  ROCK_LARGE_SIZE,
  resetIdCounter,
  SHIP_RADIUS,
  SHIP_REGENERATION_GRACE_PERIOD,
  spawnRock,
  spawnShip,
  startPlayer,
} from '../../src/index.js'
import { createTestRng } from '../helpers/createTestRng.js'
import { entityPoint, pointFromLatLng } from '../helpers/points.js'

describe('collision detection', () => {
  let game: GameState
  let rng: RNG

  beforeEach(() => {
    resetIdCounter()
    const result = createGame({ seed: 'test' })
    game = result.state
    rng = createTestRng()
  })

  describe('greatCircleDistance', () => {
    it('returns 0 for identical positions', () => {
      const d = greatCircleDistance(10, 20, 10, 20, RADIUS)
      expect(d).toBeCloseTo(0)
    })

    it('returns correct distance for 90 degrees on equator', () => {
      const d = greatCircleDistance(0, 0, 0, 90, RADIUS)
      const expected = (RADIUS * Math.PI) / 2
      expect(d).toBeCloseTo(expected, 3)
    })

    it('returns correct distance for poles', () => {
      const d = greatCircleDistance(90, 0, -90, 0, RADIUS)
      const expected = RADIUS * Math.PI
      expect(d).toBeCloseTo(expected, 3)
    })
  })

  describe('detectCollisions — bullet-rock', () => {
    it('detects collision when bullet overlaps rock', () => {
      const ship = spawnShip(game, 'p1', pointFromLatLng(0, 0), rng)
      const rock = spawnRock(game, pointFromLatLng(0, 0), ROCK_LARGE_SIZE, rng)

      // Place a bullet at the rock's position
      const bullet = {
        id: 'test-bullet',
        orientation: rock.orientation.clone(),
        ...entityPoint(rock),
        angularVelocity: ship.angularVelocity.clone(),
        firedAt: game.now,
        ownerId: ship.id,
      }
      game.bullets.set(bullet.id, bullet)

      const pairs = detectCollisions(game, RADIUS)
      const bulletRock = pairs.filter((p) => p.type === 'bullet-rock')
      expect(bulletRock.length).toBe(1)
      expect(bulletRock[0]!.a.id).toBe('test-bullet')
      expect(bulletRock[0]!.b.id).toBe(rock.id)
    })

    it('does not detect collision when far apart', () => {
      const ship = spawnShip(game, 'p1', pointFromLatLng(0, 0), rng)
      spawnRock(game, pointFromLatLng(45, 90), ROCK_LARGE_SIZE, rng)

      const bullet = {
        id: 'test-bullet',
        orientation: ship.orientation.clone(),
        ...pointFromLatLng(0, 0),
        angularVelocity: ship.angularVelocity.clone(),
        firedAt: game.now,
        ownerId: ship.id,
      }
      game.bullets.set(bullet.id, bullet)

      const pairs = detectCollisions(game, RADIUS)
      expect(pairs.filter((p) => p.type === 'bullet-rock').length).toBe(0)
    })
  })

  describe('detectCollisions — ship-rock', () => {
    it('detects collision when overlapping', () => {
      const ship = spawnShip(game, 'p1', pointFromLatLng(10, 20), rng)
      spawnRock(game, entityPoint(ship), ROCK_LARGE_SIZE, rng)

      const pairs = detectCollisions(game, RADIUS)
      const shipRock = pairs.filter((p) => p.type === 'ship-rock')
      expect(shipRock.length).toBe(1)
    })

    it('does not detect collision when far apart', () => {
      spawnShip(game, 'p1', pointFromLatLng(0, 0), rng)
      spawnRock(game, pointFromLatLng(45, 90), ROCK_LARGE_SIZE, rng)

      const pairs = detectCollisions(game, RADIUS)
      expect(pairs.filter((p) => p.type === 'ship-rock').length).toBe(0)
    })

    it('respects grace period for recently regenerated ships', () => {
      startPlayer(game, 'p1', rng)
      const player = game.players.get('p1')!
      player.regeneratedAt = game.now

      const ship = game.ships.get(player.shipId!)!
      spawnRock(game, entityPoint(ship), ROCK_LARGE_SIZE, rng)

      const pairs = detectCollisions(game, RADIUS)
      expect(pairs.filter((p) => p.type === 'ship-rock').length).toBe(0)
    })

    it('detects collision after grace period expires', () => {
      startPlayer(game, 'p1', rng)
      const player = game.players.get('p1')!
      player.regeneratedAt = game.now

      const ship = game.ships.get(player.shipId!)!
      spawnRock(game, entityPoint(ship), ROCK_LARGE_SIZE, rng)

      // Advance past grace period
      advanceGameTime(game, SHIP_REGENERATION_GRACE_PERIOD + 100)

      const pairs = detectCollisions(game, RADIUS)
      expect(pairs.filter((p) => p.type === 'ship-rock').length).toBe(1)
    })

    it('uses exact ship intersection radius when querying rock collisions', () => {
      const ship = spawnShip(game, 'p1', pointFromLatLng(10, 20), rng)
      spawnRock(game, entityPoint(ship), ROCK_LARGE_SIZE, rng)

      let queriedRadius: number | null = null
      const spatialIndex = {
        findFirstRockIntersect(_center: unknown, radius: number) {
          queriedRadius = radius
          return undefined
        },
      } as unknown

      detectCollisions(game, RADIUS, spatialIndex as never)

      expect(queriedRadius).toBe(SHIP_RADIUS)
    })
  })

  describe('handleCollisions', () => {
    it('bullet-rock: destroys bullet, splits rock, scores player', () => {
      startPlayer(game, 'p1', rng)
      const player = game.players.get('p1')!
      const ship = game.ships.get(player.shipId!)!

      const rock = spawnRock(game, entityPoint(ship), ROCK_LARGE_SIZE, rng)

      const bullet = {
        id: 'test-bullet',
        orientation: rock.orientation.clone(),
        ...entityPoint(rock),
        angularVelocity: ship.angularVelocity.clone(),
        firedAt: game.now,
        ownerId: ship.id,
      }
      game.bullets.set(bullet.id, bullet)

      const hooks: EngineHooks = {
        onCollision: vi.fn(),
        onScoreChanged: vi.fn(),
      }

      const pairs: CollisionPair[] = [
        {
          a: { id: 'test-bullet', type: 'bullet' },
          b: { id: rock.id, type: 'rock' },
          type: 'bullet-rock',
          distance: 0,
        },
      ]

      const initialScore = player.score
      handleCollisions(game, pairs, rng, hooks)

      expect(game.bullets.has('test-bullet')).toBe(false)
      expect(game.rocks.has(rock.id)).toBe(false)
      expect(game.rocks.size).toBe(2) // Split into 2 medium
      expect(player.score).toBe(initialScore + rock.value)
      expect(hooks.onCollision).toHaveBeenCalledOnce()
      expect(hooks.onScoreChanged).toHaveBeenCalledOnce()
    })

    it('ship-rock: kills player, fires hooks', () => {
      startPlayer(game, 'p1', rng)
      const player = game.players.get('p1')!
      const ship = game.ships.get(player.shipId!)!

      const rock = spawnRock(game, entityPoint(ship), ROCK_LARGE_SIZE, rng)

      const hooks: EngineHooks = {
        onCollision: vi.fn(),
        onPlayerDied: vi.fn(),
      }

      const pairs: CollisionPair[] = [
        {
          a: { id: ship.id, type: 'ship' },
          b: { id: rock.id, type: 'rock' },
          type: 'ship-rock',
          distance: 0,
        },
      ]

      handleCollisions(game, pairs, rng, hooks)

      expect(player.alive).toBe(false)
      expect(player.shipId).toBeNull()
      expect(hooks.onCollision).toHaveBeenCalledOnce()
      expect(hooks.onPlayerDied).toHaveBeenCalledWith('p1')
    })

    it('ship-rock with 0 lives: fires game over hook', () => {
      startPlayer(game, 'p1', rng)
      const player = game.players.get('p1')!
      player.lives = 0
      const ship = game.ships.get(player.shipId!)!

      const rock = spawnRock(game, entityPoint(ship), ROCK_LARGE_SIZE, rng)

      const hooks: EngineHooks = {
        onCollision: vi.fn(),
        onPlayerDied: vi.fn(),
        onGameOver: vi.fn(),
      }

      const pairs: CollisionPair[] = [
        {
          a: { id: ship.id, type: 'ship' },
          b: { id: rock.id, type: 'rock' },
          type: 'ship-rock',
          distance: 0,
        },
      ]

      handleCollisions(game, pairs, rng, hooks)

      expect(game.endedAt).toBe(game.now)
      expect(hooks.onGameOver).toHaveBeenCalledWith('p1')
    })
  })
})
