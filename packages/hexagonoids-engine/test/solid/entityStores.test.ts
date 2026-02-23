import { createRoot } from 'solid-js'
import { beforeEach, describe, expect, it } from 'vitest'
import {
  createReactiveEngine,
  useBullet,
  useRock,
  useShip,
} from '../../src/features/solid/index.js'
import { resetIdCounter, spawnWave, startPlayer } from '../../src/index.js'

const IDLE_INPUT = (playerId: string) => ({
  [playerId]: { left: false, right: false, thrust: false, fire: false },
})

describe('useShip', () => {
  beforeEach(() => {
    resetIdCounter()
  })

  it('returns state for a known ship id', () => {
    createRoot((dispose) => {
      const engine = createReactiveEngine({ seed: 'test' })
      engine.mutate((state) => startPlayer(state, 'p1', engine.rng))

      const shipId = engine.shipIds()[0]!
      const ship = useShip(engine, shipId)

      expect(ship()).toBeDefined()
      expect(ship()!.playerId).toBe('p1')
      dispose()
    })
  })

  it('returns undefined for an unknown ship id', () => {
    createRoot((dispose) => {
      const engine = createReactiveEngine({ seed: 'test' })
      const ship = useShip(engine, 'nonexistent')

      expect(ship()).toBeUndefined()
      dispose()
    })
  })
})

describe('useRock', () => {
  beforeEach(() => {
    resetIdCounter()
  })

  it('returns state for a known rock id', () => {
    createRoot((dispose) => {
      const engine = createReactiveEngine({ seed: 'test' })
      engine.mutate((state) => spawnWave(state, 0, 0, engine.rng))

      const rockId = engine.rockIds()[0]!
      const rock = useRock(engine, rockId)

      expect(rock()).toBeDefined()
      dispose()
    })
  })

  it('returns undefined for an unknown rock id', () => {
    createRoot((dispose) => {
      const engine = createReactiveEngine({ seed: 'test' })
      const rock = useRock(engine, 'nonexistent')

      expect(rock()).toBeUndefined()
      dispose()
    })
  })
})

describe('useBullet', () => {
  beforeEach(() => {
    resetIdCounter()
  })

  it('returns state for a known bullet id', () => {
    createRoot((dispose) => {
      const engine = createReactiveEngine({ seed: 'test' })

      engine.mutate((state) => startPlayer(state, 'p1', engine.rng))
      engine.tick(IDLE_INPUT('p1'), 0.016)

      // Fire a bullet
      engine.tick(
        { p1: { left: false, right: false, thrust: false, fire: true } },
        0.016
      )

      const bulletId = engine.bulletIds()[0]!
      const bullet = useBullet(engine, bulletId)

      expect(bullet()).toBeDefined()
      dispose()
    })
  })

  it('returns undefined for an unknown bullet id', () => {
    createRoot((dispose) => {
      const engine = createReactiveEngine({ seed: 'test' })
      const bullet = useBullet(engine, 'nonexistent')

      expect(bullet()).toBeUndefined()
      dispose()
    })
  })
})
