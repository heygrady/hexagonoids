import { createRoot } from 'solid-js'
import { beforeEach, describe, expect, it } from 'vitest'
import {
  createReactiveEngine,
  useEntityPool,
} from '../../src/features/solid/index.js'
import { resetIdCounter, spawnWave, startPlayer } from '../../src/index.js'

describe('useEntityPool', () => {
  beforeEach(() => {
    resetIdCounter()
  })

  it('returns ship pool accessor for ship entity type', () => {
    createRoot((dispose) => {
      const engine = createReactiveEngine({ seed: 'test' })
      const ids = useEntityPool(engine, 'ship')

      expect(ids()).toHaveLength(0)

      engine.mutate((state) => startPlayer(state, 'p1', engine.rng))

      expect(ids().length).toBeGreaterThan(0)
      expect(ids()).toEqual(engine.shipIds())
      dispose()
    })
  })

  it('returns rock pool accessor for rock entity type', () => {
    createRoot((dispose) => {
      const engine = createReactiveEngine({ seed: 'test' })
      const ids = useEntityPool(engine, 'rock')

      expect(ids()).toHaveLength(0)

      engine.mutate((state) => spawnWave(state, 0, 0, engine.rng))

      expect(ids().length).toBeGreaterThan(0)
      expect(ids()).toEqual(engine.rockIds())
      dispose()
    })
  })

  it('returns bullet pool accessor for bullet entity type', () => {
    createRoot((dispose) => {
      const engine = createReactiveEngine({ seed: 'test' })
      const ids = useEntityPool(engine, 'bullet')

      expect(ids()).toHaveLength(0)
      expect(ids()).toEqual(engine.bulletIds())
      dispose()
    })
  })
})
