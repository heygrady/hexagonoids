import type { RNG } from '@neat-evolution/utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { EngineHooks, GameState, PlayerInputs } from '../../src/index.js'
import {
  advanceGameTime,
  BULLET_LIFETIME,
  createGame,
  ROCK_LARGE_SIZE,
  ROCK_WAVE_PERIOD,
  resetIdCounter,
  SHIP_REGENERATION_GRACE_PERIOD,
  SHIP_REGENERATION_WAIT_PERIOD,
  spawnRock,
  startPlayer,
  step,
} from '../../src/index.js'
import { createTestRng } from '../helpers/createTestRng.js'

const NO_INPUT: PlayerInputs = {}
const IDLE_INPUT = (playerId: string): PlayerInputs => ({
  [playerId]: { left: false, right: false, thrust: false, fire: false },
})

describe('step function', () => {
  let game: GameState
  let rng: RNG

  beforeEach(() => {
    resetIdCounter()
    const result = createGame({ seed: 'test' })
    game = result.state
    rng = createTestRng()
  })

  describe('basic stepping', () => {
    it('advances game time', () => {
      startPlayer(game, 'p1', rng)
      step(game, NO_INPUT, 16, rng)
      expect(game.now).toBeCloseTo(16, 0)
    })

    it('does not step if game is over', () => {
      startPlayer(game, 'p1', rng)
      game.endedAt = game.now
      const nowBefore = game.now
      step(game, NO_INPUT, 16, rng)
      expect(game.now).toBe(nowBefore)
    })

    it('ship moves when stepping with no input', () => {
      startPlayer(game, 'p1', rng)
      const player = game.players.get('p1')!
      const ship = game.ships.get(player.shipId!)!

      // Give ship some velocity
      ship.angularVelocity.x = 0.1

      const latBefore = ship.lat
      const lngBefore = ship.lng

      step(game, NO_INPUT, 16, rng)

      // Position should have changed
      const moved = ship.lat !== latBefore || ship.lng !== lngBefore
      expect(moved).toBe(true)
    })
  })

  describe('input application', () => {
    it('ship fires bullet on fire input', () => {
      startPlayer(game, 'p1', rng)
      expect(game.bullets.size).toBe(0)

      const inputs: PlayerInputs = {
        p1: { left: false, right: false, thrust: false, fire: true },
      }
      step(game, inputs, 16, rng)

      expect(game.bullets.size).toBe(1)
    })

    it('ship turns with left/right input', () => {
      startPlayer(game, 'p1', rng)
      const player = game.players.get('p1')!
      const ship = game.ships.get(player.shipId!)!

      const inputs: PlayerInputs = {
        p1: { left: true, right: false, thrust: false, fire: false },
      }
      // First step records the input hold start (duration=0, easing=0%).
      // Second step has duration > 0, so the turn easing kicks in.
      step(game, inputs, 16, rng)
      const yawAfterFirstStep = ship.yaw
      step(game, inputs, 16, rng)

      expect(ship.yaw).not.toBe(yawAfterFirstStep)
    })

    it('ship accelerates with thrust input', () => {
      startPlayer(game, 'p1', rng)
      const player = game.players.get('p1')!
      const ship = game.ships.get(player.shipId!)!

      const inputs: PlayerInputs = {
        p1: { left: false, right: false, thrust: true, fire: false },
      }
      step(game, inputs, 16, rng)

      // Angular velocity should be non-zero after thrust
      expect(ship.angularVelocity.length()).toBeGreaterThan(0)
    })
  })

  describe('bullet expiration', () => {
    it('bullets expire after lifetime', () => {
      startPlayer(game, 'p1', rng)

      // Fire a bullet
      const fireInputs: PlayerInputs = {
        p1: { left: false, right: false, thrust: false, fire: true },
      }
      step(game, fireInputs, 16, rng)
      expect(game.bullets.size).toBe(1)

      // Step past bullet lifetime
      const stepsNeeded = Math.ceil(BULLET_LIFETIME / 16) + 2
      for (let i = 0; i < stepsNeeded; i++) {
        step(game, IDLE_INPUT('p1'), 16, rng)
      }

      expect(game.bullets.size).toBe(0)
    })
  })

  describe('collision — bullet hits rock', () => {
    it('bullet destroys rock and scores player', () => {
      startPlayer(game, 'p1', rng)
      const player = game.players.get('p1')!
      const ship = game.ships.get(player.shipId!)!

      // Place a rock right at the ship's position
      const rock = spawnRock(game, ship.lat, ship.lng, ROCK_LARGE_SIZE, rng)

      // Place a bullet at the rock's position
      const bullet = {
        id: 'test-bullet',
        orientation: rock.orientation.clone(),
        lat: rock.lat,
        lng: rock.lng,
        angularVelocity: ship.angularVelocity.clone(),
        firedAt: game.now,
        ownerId: ship.id,
      }
      game.bullets.set(bullet.id, bullet)

      step(game, NO_INPUT, 16, rng)

      // Bullet should be destroyed
      expect(game.bullets.has('test-bullet')).toBe(false)
      // Rock should be split (original destroyed, 2 children)
      expect(game.rocks.has(rock.id)).toBe(false)
      // Player scored
      expect(player.score).toBe(rock.value)
    })
  })

  describe('collision — ship hits rock', () => {
    it('ship collision kills player', () => {
      startPlayer(game, 'p1', rng)
      const player = game.players.get('p1')!
      const ship = game.ships.get(player.shipId!)!

      // Place a rock at ship position
      spawnRock(game, ship.lat, ship.lng, ROCK_LARGE_SIZE, rng)

      // Advance past grace period so collision is detected
      advanceGameTime(game, SHIP_REGENERATION_GRACE_PERIOD + 100)
      // Set regeneratedAt far enough in the past
      player.regeneratedAt = 0

      const hooks: EngineHooks = {
        onPlayerDied: vi.fn(),
      }

      step(game, NO_INPUT, 16, rng, hooks)

      expect(player.alive).toBe(false)
      expect(hooks.onPlayerDied).toHaveBeenCalledWith('p1')
    })
  })

  describe('player regeneration', () => {
    it('regenerates player after wait period', () => {
      startPlayer(game, 'p1', rng)
      const player = game.players.get('p1')!
      player.lives = 2

      // Kill player manually
      player.alive = false
      player.diedAt = game.now
      if (player.shipId != null) {
        game.ships.delete(player.shipId)
        player.shipId = null
      }

      // Step past wait period
      const stepsNeeded = Math.ceil(SHIP_REGENERATION_WAIT_PERIOD / 16) + 2
      for (let i = 0; i < stepsNeeded; i++) {
        step(game, NO_INPUT, 16, rng)
      }

      expect(player.alive).toBe(true)
      expect(player.shipId).not.toBeNull()
      expect(player.lives).toBe(1) // Decremented by regeneration
    })
  })

  describe('wave spawning', () => {
    it('spawns initial wave', () => {
      startPlayer(game, 'p1', rng)
      // First step should trigger wave spawn (waveSpawnedAt is null)
      step(game, NO_INPUT, 16, rng)

      expect(game.rocks.size).toBeGreaterThan(0)
      expect(game.wave).toBe(1)
    })

    it('spawns subsequent waves after period elapses', () => {
      startPlayer(game, 'p1', rng)

      // First step triggers initial wave
      step(game, NO_INPUT, 16, rng)

      // Step past wave period
      const stepsNeeded = Math.ceil(ROCK_WAVE_PERIOD / 16) + 2
      for (let i = 0; i < stepsNeeded; i++) {
        step(game, IDLE_INPUT('p1'), 16, rng)
      }

      expect(game.wave).toBe(2)
    })
  })

  describe('game over', () => {
    it('sets endedAt when player dies with 0 lives', () => {
      startPlayer(game, 'p1', rng)
      const player = game.players.get('p1')!
      player.lives = 0

      const ship = game.ships.get(player.shipId!)!

      // Place rock at ship position and advance past grace
      spawnRock(game, ship.lat, ship.lng, ROCK_LARGE_SIZE, rng)
      player.regeneratedAt = 0
      advanceGameTime(game, SHIP_REGENERATION_GRACE_PERIOD + 100)

      step(game, NO_INPUT, 16, rng)

      expect(game.endedAt).not.toBeNull()
    })
  })

  describe('engine hooks', () => {
    it('onCollision fires with bullet-rock type on bullet-rock hit', () => {
      startPlayer(game, 'p1', rng)
      const player = game.players.get('p1')!
      const ship = game.ships.get(player.shipId!)!

      // Place a rock at ship position
      const rock = spawnRock(game, ship.lat, ship.lng, ROCK_LARGE_SIZE, rng)

      // Place a bullet at the rock's position
      const bullet = {
        id: 'test-bullet',
        orientation: rock.orientation.clone(),
        lat: rock.lat,
        lng: rock.lng,
        angularVelocity: ship.angularVelocity.clone(),
        firedAt: game.now,
        ownerId: ship.id,
      }
      game.bullets.set(bullet.id, bullet)

      const hooks: EngineHooks = {
        onCollision: vi.fn(),
        onScoreChanged: vi.fn(),
      }

      step(game, NO_INPUT, 16, rng, hooks)

      expect(hooks.onCollision).toHaveBeenCalledWith(
        { id: 'test-bullet', type: 'bullet' },
        { id: rock.id, type: 'rock' },
        'bullet-rock'
      )
      expect(hooks.onScoreChanged).toHaveBeenCalledWith(
        'p1',
        rock.value,
        rock.value
      )
    })

    it('onPlayerRegenerated fires when dead player regenerates', () => {
      startPlayer(game, 'p1', rng)
      const player = game.players.get('p1')!
      player.lives = 2

      // Kill player manually
      player.alive = false
      player.diedAt = game.now
      if (player.shipId != null) {
        game.ships.delete(player.shipId)
        player.shipId = null
      }

      const hooks: EngineHooks = {
        onPlayerRegenerated: vi.fn(),
      }

      // Step past wait period
      const stepsNeeded = Math.ceil(SHIP_REGENERATION_WAIT_PERIOD / 16) + 2
      for (let i = 0; i < stepsNeeded; i++) {
        step(game, NO_INPUT, 16, rng, hooks)
      }

      expect(player.alive).toBe(true)
      expect(hooks.onPlayerRegenerated).toHaveBeenCalledWith('p1')
    })
  })

  describe('determinism', () => {
    it('same seed and inputs produce identical state', () => {
      // Run 1
      resetIdCounter()
      const run1 = createGame({ seed: 'determinism' })
      const rng1 = createTestRng()
      startPlayer(run1.state, 'p1', rng1)

      const inputs: PlayerInputs = {
        p1: { left: true, right: false, thrust: true, fire: true },
      }

      for (let i = 0; i < 10; i++) {
        step(run1.state, inputs, 16, rng1)
      }

      // Run 2 — same seed, same inputs
      resetIdCounter()
      const run2 = createGame({ seed: 'determinism' })
      const rng2 = createTestRng()
      startPlayer(run2.state, 'p1', rng2)

      for (let i = 0; i < 10; i++) {
        step(run2.state, inputs, 16, rng2)
      }

      // States should be identical
      expect(run1.state.now).toBe(run2.state.now)

      const p1a = run1.state.players.get('p1')!
      const p1b = run2.state.players.get('p1')!
      expect(p1a.score).toBe(p1b.score)
      expect(p1a.alive).toBe(p1b.alive)
      expect(p1a.lives).toBe(p1b.lives)

      // Same number of entities
      expect(run1.state.ships.size).toBe(run2.state.ships.size)
      expect(run1.state.rocks.size).toBe(run2.state.rocks.size)
      expect(run1.state.bullets.size).toBe(run2.state.bullets.size)
    })
  })
})
