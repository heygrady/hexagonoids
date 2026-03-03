import { createRoot } from 'solid-js'
import { beforeEach, describe, expect, it } from 'vitest'
import {
  createReactiveEngine,
  useGameOver,
  useGameTime,
  useWave,
} from '../../src/features/solid/index.js'
import {
  latLngToSpatialPoint,
  resetIdCounter,
  spawnWave,
  startPlayer,
} from '../../src/index.js'

const IDLE_INPUT = (playerId: string) => ({
  [playerId]: { left: false, right: false, thrust: false, fire: false },
})

describe('createReactiveEngine', () => {
  beforeEach(() => {
    resetIdCounter()
  })

  it('returns valid state', () => {
    createRoot((dispose) => {
      const engine = createReactiveEngine({ seed: 'test' })
      expect(engine.state).toBeDefined()
      expect(engine.state.now).toBe(0)
      expect(engine.state.wave).toBe(0)
      expect(engine.state.endedAt).toBeNull()
      expect(engine.tick).toBeInstanceOf(Function)
      expect(engine.getSpatialIndex).toBeInstanceOf(Function)
      expect(engine.rng).toBeDefined()
      dispose()
    })
  })

  it('invalidates the cached spatial index after reactive mutations', () => {
    createRoot((dispose) => {
      const engine = createReactiveEngine({ seed: 'test' })
      const before = engine.getSpatialIndex()

      engine.mutate((state) => spawnWave(state, 0, 0, engine.rng))

      const after = engine.getSpatialIndex()
      expect(after).not.toBe(before)
      expect(
        engine.queryRocksNear(latLngToSpatialPoint(0, 0), Math.PI).length
      ).toBeGreaterThan(0)
      dispose()
    })
  })

  it('tick advances game time', () => {
    createRoot((dispose) => {
      const engine = createReactiveEngine({ seed: 'test' })
      expect(engine.state.now).toBe(0)

      engine.mutate((state) => startPlayer(state, 'p1', engine.rng))
      engine.tick(IDLE_INPUT('p1'), 16)

      expect(engine.state.now).toBeGreaterThan(0)
      dispose()
    })
  })

  it('reactive memos track game time changes', () => {
    createRoot((dispose) => {
      const engine = createReactiveEngine({ seed: 'test' })
      const gameTime = useGameTime(engine)

      expect(gameTime()).toBe(0)

      engine.mutate((state) => startPlayer(state, 'p1', engine.rng))
      engine.tick(IDLE_INPUT('p1'), 16)

      expect(gameTime()).toBeGreaterThan(0)
      dispose()
    })
  })

  it('pool signals update when entities are added', () => {
    createRoot((dispose) => {
      const engine = createReactiveEngine({ seed: 'test' })

      expect(engine.shipIds()).toHaveLength(0)
      expect(engine.rockIds()).toHaveLength(0)

      // startPlayer spawns a ship; mutate wraps it in produce for reactivity
      engine.mutate((state) => startPlayer(state, 'p1', engine.rng))

      expect(engine.shipIds().length).toBeGreaterThan(0)
      expect(engine.playerIds().length).toBeGreaterThan(0)
      dispose()
    })
  })

  it('entity state changes are tracked', () => {
    createRoot((dispose) => {
      const engine = createReactiveEngine({ seed: 'test' })

      engine.mutate((state) => startPlayer(state, 'p1', engine.rng))
      engine.tick(IDLE_INPUT('p1'), 16)

      const ids = engine.shipIds()
      expect(ids.length).toBeGreaterThan(0)

      const shipId = ids[0]!
      const ship = engine.state.ships.get(shipId)
      expect(ship).toBeDefined()

      // Tick with thrust to change ship state
      engine.tick(
        { p1: { left: false, right: false, thrust: true, fire: false } },
        100
      )

      const updatedShip = engine.state.ships.get(shipId)
      expect(updatedShip).toBeDefined()
      // After thrust, angular velocity should be non-zero
      expect(updatedShip!.angularVelocity.length()).toBeGreaterThan(0)
      dispose()
    })
  })

  it('useGameOver tracks end state', () => {
    createRoot((dispose) => {
      const engine = createReactiveEngine({ seed: 'test' })
      const gameOver = useGameOver(engine)

      expect(gameOver()).toBe(false)
      dispose()
    })
  })

  it('useWave tracks wave number', () => {
    createRoot((dispose) => {
      const engine = createReactiveEngine({ seed: 'test' })
      const wave = useWave(engine)

      expect(wave()).toBe(0)
      dispose()
    })
  })

  it('bullet pool updates when bullets spawn', () => {
    createRoot((dispose) => {
      const engine = createReactiveEngine({ seed: 'test' })

      expect(engine.bulletIds()).toHaveLength(0)

      engine.mutate((state) => startPlayer(state, 'p1', engine.rng))
      engine.tick(IDLE_INPUT('p1'), 16)

      // Fire a bullet
      engine.tick(
        { p1: { left: false, right: false, thrust: false, fire: true } },
        16
      )

      expect(engine.bulletIds().length).toBeGreaterThan(0)
      dispose()
    })
  })

  it('pool signals track entity removal', () => {
    createRoot((dispose) => {
      const engine = createReactiveEngine({ seed: 'test' })

      engine.mutate((state) => startPlayer(state, 'p1', engine.rng))
      expect(engine.shipIds().length).toBe(1)

      // Remove the ship
      const shipId = engine.shipIds()[0]!
      engine.mutate((state) => {
        state.ships.delete(shipId)
      })

      expect(engine.shipIds().length).toBe(0)
      dispose()
    })
  })

  it('rock pool signal updates when rocks are added via spawnWave', () => {
    createRoot((dispose) => {
      const engine = createReactiveEngine({ seed: 'test' })

      expect(engine.rockIds()).toHaveLength(0)

      engine.mutate((state) => spawnWave(state, 0, 0, engine.rng))

      expect(engine.rockIds().length).toBeGreaterThan(0)
      dispose()
    })
  })

  it('reseed clears entities and resets game time', () => {
    createRoot((dispose) => {
      const engine = createReactiveEngine({ seed: 'test' })

      // Add entities and advance time
      engine.mutate((state) => startPlayer(state, 'p1', engine.rng))
      engine.tick(IDLE_INPUT('p1'), 16)
      engine.mutate((state) => spawnWave(state, 0, 0, engine.rng))

      expect(engine.state.now).toBeGreaterThan(0)
      expect(engine.rockIds().length).toBeGreaterThan(0)

      // Reseed should clear everything and start fresh
      engine.reseed('new-seed', 'p1')

      expect(engine.state.now).toBe(0)
      expect(engine.state.wave).toBe(0)
      expect(engine.rockIds()).toHaveLength(0)
      expect(engine.bulletIds()).toHaveLength(0)
      // startPlayer is called inside reseed, so ship/player exist
      expect(engine.shipIds().length).toBe(1)
      expect(engine.playerIds().length).toBe(1)
      dispose()
    })
  })

  it('reseed with a different seed produces a different RNG', () => {
    createRoot((dispose) => {
      const engine = createReactiveEngine({ seed: 'seed-a' })
      const rngBefore = engine.rng

      engine.reseed('seed-b', 'p1')

      // The rng getter should return a new RNG instance
      expect(engine.rng).not.toBe(rngBefore)
      dispose()
    })
  })
})
