import { createRoot } from 'solid-js'
import { beforeEach, describe, expect, it } from 'vitest'
import {
  createReactiveEngine,
  useGameOver,
  useGameTime,
  useWave,
} from '../../src/features/solid/index.js'
import { resetIdCounter, spawnWave, startPlayer } from '../../src/index.js'

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
      expect(engine.rng).toBeDefined()
      dispose()
    })
  })

  it('tick advances game time', () => {
    createRoot((dispose) => {
      const engine = createReactiveEngine({ seed: 'test' })
      expect(engine.state.now).toBe(0)

      engine.mutate((state) => startPlayer(state, 'p1', engine.rng))
      engine.tick(IDLE_INPUT('p1'), 0.016)

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
      engine.tick(IDLE_INPUT('p1'), 0.016)

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
      engine.tick(IDLE_INPUT('p1'), 0.016)

      const ids = engine.shipIds()
      expect(ids.length).toBeGreaterThan(0)

      const shipId = ids[0]!
      const ship = engine.state.ships.get(shipId)
      expect(ship).toBeDefined()

      // Tick with thrust to change ship state
      engine.tick(
        { p1: { left: false, right: false, thrust: true, fire: false } },
        0.1
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
      engine.tick(IDLE_INPUT('p1'), 0.016)

      // Fire a bullet
      engine.tick(
        { p1: { left: false, right: false, thrust: false, fire: true } },
        0.016
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
})
