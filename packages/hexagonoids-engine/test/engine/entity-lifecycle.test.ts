import type { RNG } from '@neat-evolution/utils'
import { beforeEach, describe, expect, it } from 'vitest'
import type { GameState } from '../../src/index.js'
import {
  advanceGameTime,
  BULLET_LIFETIME,
  canRegenerate,
  checkWaveSpawn,
  createGame,
  destroyRock,
  destroyShip,
  evaluateWaveSpawnGate,
  expireBullets,
  FIRE_COOLDOWN,
  fireBullet,
  killPlayer,
  PLAYER_STARTING_LIVES,
  ROCK_LARGE_SIZE,
  ROCK_LARGE_VALUE,
  ROCK_MEDIUM_SIZE,
  ROCK_MEDIUM_VALUE,
  ROCK_SMALL_SIZE,
  ROCK_WAVE_RETRY_DEFER_PERIOD,
  regeneratePlayer,
  resetIdCounter,
  SHIP_REGENERATION_WAIT_PERIOD,
  scorePlayer,
  spawnRock,
  spawnShip,
  spawnWave,
  splitRock,
  startPlayer,
} from '../../src/index.js'
import { createTestRng } from '../helpers/createTestRng.js'

describe('entity lifecycle', () => {
  let game: GameState
  let rng: RNG

  beforeEach(() => {
    resetIdCounter()
    const result = createGame({ seed: 'test' })
    game = result.state
    rng = createTestRng()
  })

  describe('player lifecycle', () => {
    it('can start a player (spawns ship)', () => {
      startPlayer(game, 'p1', rng)

      const player = game.players.get('p1')
      expect(player).toBeDefined()
      expect(player!.alive).toBe(true)
      expect(player!.lives).toBe(PLAYER_STARTING_LIVES)
      expect(player!.score).toBe(0)
      expect(player!.shipId).not.toBeNull()
      expect(player!.startedAt).toBe(0)

      // Ship was spawned
      expect(game.ships.size).toBe(1)
      const ship = game.ships.get(player!.shipId!)
      expect(ship).toBeDefined()
      expect(ship!.playerId).toBe('p1')
      expect(ship!.alive).toBe(true)
    })

    it('player dies → alive=false, diedAt set', () => {
      startPlayer(game, 'p1', rng)
      advanceGameTime(game, 1000)

      killPlayer(game, 'p1')

      const player = game.players.get('p1')!
      expect(player.alive).toBe(false)
      expect(player.diedAt).toBe(game.now)
      expect(player.shipId).toBeNull()
      expect(game.ships.size).toBe(0)
    })

    it('player regenerates → new ship spawned, lives decremented', () => {
      startPlayer(game, 'p1', rng)
      advanceGameTime(game, 1000)
      killPlayer(game, 'p1')

      // Advance past regeneration wait period
      advanceGameTime(game, SHIP_REGENERATION_WAIT_PERIOD + 100)

      expect(canRegenerate(game, 'p1')).toBe(true)
      regeneratePlayer(game, 'p1', rng)

      const player = game.players.get('p1')!
      expect(player.alive).toBe(true)
      expect(player.lives).toBe(PLAYER_STARTING_LIVES - 1)
      expect(player.shipId).not.toBeNull()
      expect(game.ships.size).toBe(1)
    })

    it('game over when player dies with no lives', () => {
      startPlayer(game, 'p1', rng)
      const player = game.players.get('p1')!
      player.lives = 0

      killPlayer(game, 'p1')
      expect(game.endedAt).toBe(game.now)
    })

    it('scorePlayer awards points', () => {
      startPlayer(game, 'p1', rng)
      scorePlayer(game, 'p1', 100)

      const player = game.players.get('p1')!
      expect(player.score).toBe(100)
    })
  })

  describe('ship actions', () => {
    it('spawnShip creates a ship in the game', () => {
      const ship = spawnShip(game, 'p1', 10, 20, rng)
      expect(game.ships.has(ship.id)).toBe(true)
      expect(ship.playerId).toBe('p1')
      expect(ship.alive).toBe(true)
    })

    it('destroyShip removes a ship', () => {
      const ship = spawnShip(game, 'p1', 10, 20, rng)
      expect(game.ships.size).toBe(1)
      destroyShip(game, ship.id)
      expect(game.ships.size).toBe(0)
    })
  })

  describe('bullet lifecycle', () => {
    it('can fire a bullet from a ship', () => {
      const ship = spawnShip(game, 'p1', 0, 0, rng)

      const bullet = fireBullet(game, ship, rng)
      expect(bullet).not.toBeNull()
      expect(game.bullets.size).toBe(1)
      expect(bullet!.ownerId).toBe(ship.id)
      expect(bullet!.firedAt).toBe(game.now)
    })

    it('fireBullet respects cooldown', () => {
      const ship = spawnShip(game, 'p1', 0, 0, rng)

      const bullet1 = fireBullet(game, ship, rng)
      expect(bullet1).not.toBeNull()

      // Immediately try again — should be on cooldown
      const bullet2 = fireBullet(game, ship, rng)
      expect(bullet2).toBeNull()

      // Advance past cooldown
      advanceGameTime(game, FIRE_COOLDOWN + 10)
      const bullet3 = fireBullet(game, ship, rng)
      expect(bullet3).not.toBeNull()
      expect(game.bullets.size).toBe(2)
    })

    it('expireBullets removes old bullets', () => {
      const ship = spawnShip(game, 'p1', 0, 0, rng)
      fireBullet(game, ship, rng)
      expect(game.bullets.size).toBe(1)

      // Advance past bullet lifetime
      advanceGameTime(game, BULLET_LIFETIME + 100)
      expireBullets(game)
      expect(game.bullets.size).toBe(0)
    })
  })

  describe('rock lifecycle', () => {
    it('can spawn a rock', () => {
      const rock = spawnRock(game, 10, 20, ROCK_LARGE_SIZE, rng)
      expect(game.rocks.has(rock.id)).toBe(true)
      expect(rock.size).toBe(ROCK_LARGE_SIZE)
      expect(rock.value).toBe(ROCK_LARGE_VALUE)
    })

    it('splitRock creates two smaller rocks from a large rock', () => {
      const rock = spawnRock(game, 10, 20, ROCK_LARGE_SIZE, rng)
      expect(game.rocks.size).toBe(1)

      splitRock(game, rock, rng)

      // Original destroyed, 2 new ones created
      expect(game.rocks.has(rock.id)).toBe(false)
      expect(game.rocks.size).toBe(2)

      for (const child of game.rocks.values()) {
        expect(child.size).toBe(ROCK_MEDIUM_SIZE)
        expect(child.value).toBe(ROCK_MEDIUM_VALUE)
        expect(child.angularVelocity.length()).toBeGreaterThan(0)
        expect(child.lat !== rock.lat || child.lng !== rock.lng).toBe(true)
      }
    })

    it('splitRock destroys small rocks', () => {
      const rock = spawnRock(game, 10, 20, ROCK_SMALL_SIZE, rng)
      splitRock(game, rock, rng)
      expect(game.rocks.size).toBe(0)
    })

    it('destroyRock removes a rock', () => {
      const rock = spawnRock(game, 10, 20, ROCK_LARGE_SIZE, rng)
      destroyRock(game, rock.id)
      expect(game.rocks.size).toBe(0)
    })

    it('spawnWave spawns rocks around a position', () => {
      spawnWave(game, 0, 0, rng)
      // ROCK_WAVE_SIZES[0] = 4
      expect(game.rocks.size).toBe(4)
      expect(game.wave).toBe(1)
    })
  })

  describe('wave spawning via checkWaveSpawn', () => {
    it('spawns first wave immediately then respects grace period', () => {
      startPlayer(game, 'p1', rng)

      // First wave spawns immediately (no grace period on first call)
      checkWaveSpawn(game, 'p1', rng)
      expect(game.rocks.size).toBeGreaterThan(0)
      expect(game.wave).toBe(1)

      const firstWaveCount = game.rocks.size

      // Not enough time for another wave
      advanceGameTime(game, 1000)
      checkWaveSpawn(game, 'p1', rng)
      expect(game.rocks.size).toBe(firstWaveCount)
    })

    it('defers next check when blocked by local clutter', () => {
      startPlayer(game, 'p1', rng)
      const player = game.players.get('p1')!
      const ship = game.ships.get(player.shipId!)!

      // Force gate evaluation now and create local clutter at the ship.
      player.nextWaveCheckAt = game.now
      spawnRock(game, ship.lat, ship.lng, ROCK_LARGE_SIZE, rng)

      checkWaveSpawn(game, 'p1', rng)

      expect(game.wave).toBe(0)
      expect(player.nextWaveCheckAt).toBe(
        game.now + ROCK_WAVE_RETRY_DEFER_PERIOD
      )
    })

    it('blocks waves when world cap is already saturated', () => {
      startPlayer(game, 'p1', rng)
      const player = game.players.get('p1')!
      const ship = game.ships.get(player.shipId!)!

      player.nextWaveCheckAt = game.now
      player.score = 0 // cap starts at wave size 4 * 5 = 20

      for (let i = 0; i < 20; i++) {
        spawnRock(
          game,
          ship.lat + i * 0.1,
          ship.lng + i * 0.1,
          ROCK_LARGE_SIZE,
          rng
        )
      }

      const gate = evaluateWaveSpawnGate(game, ship.lat, ship.lng, player.score)
      expect(gate.canSpawn).toBe(false)
      expect(gate.reason).toBe('world-cap')
    })

    it('replenishes after no nearby encounters for a while', () => {
      startPlayer(game, 'p1', rng)
      const player = game.players.get('p1')!
      const ship = game.ships.get(player.shipId!)!

      // Simulate a single leftover far from the player.
      spawnRock(game, -ship.lat, ship.lng + 120, ROCK_LARGE_SIZE, rng)
      player.nextWaveCheckAt = game.now
      player.lastRockEncounterAt = 0

      // Before timeout, should remain blocked at low score.
      checkWaveSpawn(game, 'p1', rng)
      expect(game.wave).toBe(0)

      // After timeout, should spawn despite leftover far rock.
      advanceGameTime(game, 4100)
      checkWaveSpawn(game, 'p1', rng)
      expect(game.wave).toBe(1)
      expect(game.rocks.size).toBeGreaterThan(1)
    })
  })
})
