// @ts-nocheck
/**
 * Nanostores performance benchmarks
 *
 * Measures overhead of nanostores MapStore vs plain objects for patterns
 * used in the hexagonoids game engine. Designed to answer: is nanostores
 * suitable for a headless game engine that also needs to power training?
 *
 * Benchmarks:
 * 1. Store creation (entity spawn)
 * 2. .get() reads (per-frame hot loop)
 * 3. .setKey() single-key mutations (per-frame position updates)
 * 4. .set() full replace (pool reset)
 * 5. Pool store add/remove (entity lifecycle)
 * 6. Game tick variants: setKey, .set() batch, plain objects
 * 7. Subscriber overhead
 * 8. Realistic game frame: mixed operations (spawn, tick, despawn)
 */
import { type MapStore, map } from 'nanostores'
import { bench, describe } from 'vitest'

// ---------------------------------------------------------------------------
// Types mirroring the hexagonoids entity state (simplified, no Babylon refs)
// ---------------------------------------------------------------------------
interface ShipState {
  id: string
  type: 'ship' | 'segment'
  lat: number
  lng: number
  yaw: number
  angularVelocityX: number
  angularVelocityY: number
  angularVelocityZ: number
  firedAt: number | null
  alive: boolean
}

const defaultShipState: ShipState = {
  id: '',
  type: 'ship',
  lat: 0,
  lng: 0,
  yaw: 0,
  angularVelocityX: 0,
  angularVelocityY: 0,
  angularVelocityZ: 0,
  firedAt: null,
  alive: true,
}

type ShipStore = MapStore<ShipState>

// ---------------------------------------------------------------------------
// 1. Store creation vs plain object creation
// ---------------------------------------------------------------------------
describe('entity creation', () => {
  let counter = 0

  bench('nanostores map()', () => {
    const $ship = map<ShipState>({
      ...defaultShipState,
      id: `ship-${counter++}`,
    })
    // Prevent dead-code elimination
    if ($ship.get().id === '') throw new Error()
  })

  bench('plain object', () => {
    const ship: ShipState = { ...defaultShipState, id: `ship-${counter++}` }
    if (ship.id === '') throw new Error()
  })
})

// ---------------------------------------------------------------------------
// 2. .get() reads (per-frame hot loop — called 60x/sec per entity)
// ---------------------------------------------------------------------------
describe('.get() reads (per-frame)', () => {
  const $ship = map<ShipState>({ ...defaultShipState, id: 'ship-read' })
  const ship: ShipState = { ...defaultShipState, id: 'ship-read' }

  bench('nanostores .get()', () => {
    const state = $ship.get()
    // Read multiple fields like the per-frame update does
    const _lat = state.lat
    const _lng = state.lng
    const _yaw = state.yaw
    const _vx = state.angularVelocityX
    const _vy = state.angularVelocityY
    const _vz = state.angularVelocityZ
  })

  bench('plain object read', () => {
    const _lat = ship.lat
    const _lng = ship.lng
    const _yaw = ship.yaw
    const _vx = ship.angularVelocityX
    const _vy = ship.angularVelocityY
    const _vz = ship.angularVelocityZ
  })
})

// ---------------------------------------------------------------------------
// 3. .setKey() single-key mutations with change guard
//    (mirrors ShipSetters pattern: check before write)
// ---------------------------------------------------------------------------
describe('.setKey() with change guard (per-frame position update)', () => {
  const $ship = map<ShipState>({ ...defaultShipState, id: 'ship-setkey' })
  const ship: ShipState = { ...defaultShipState, id: 'ship-setkey' }
  let tick = 0

  bench('nanostores .setKey()', () => {
    tick++
    const newLat = Math.sin(tick * 0.01) * 90
    const newLng = Math.cos(tick * 0.01) * 180

    // Change-guard pattern from ShipSetters.ts
    if ($ship.get().lat !== newLat) {
      $ship.setKey('lat', newLat)
    }
    if ($ship.get().lng !== newLng) {
      $ship.setKey('lng', newLng)
    }
  })

  bench('plain object mutation', () => {
    tick++
    const newLat = Math.sin(tick * 0.01) * 90
    const newLng = Math.cos(tick * 0.01) * 180

    if (ship.lat !== newLat) {
      ship.lat = newLat
    }
    if (ship.lng !== newLng) {
      ship.lng = newLng
    }
  })
})

// ---------------------------------------------------------------------------
// 4. .set() full replace (pool reset)
// ---------------------------------------------------------------------------
describe('.set() full replace (pool reset)', () => {
  const $ship = map<ShipState>({ ...defaultShipState, id: 'ship-reset' })
  const ship: ShipState = { ...defaultShipState, id: 'ship-reset' }

  bench('nanostores .set()', () => {
    $ship.set({ ...defaultShipState, id: 'ship-reset' })
  })

  bench('plain Object.assign()', () => {
    Object.assign(ship, defaultShipState, { id: 'ship-reset' })
  })
})

// ---------------------------------------------------------------------------
// 5. Pool store operations (add/remove entities from active pool)
// ---------------------------------------------------------------------------
describe('pool store add/remove (entity lifecycle)', () => {
  type PoolState = Record<string, ShipStore | undefined>
  const $pool = map<PoolState>({})
  const pool: Record<string, ShipState | undefined> = {}

  // Pre-create stores to isolate pool operations
  const stores: ShipStore[] = []
  const objects: ShipState[] = []
  for (let i = 0; i < 100; i++) {
    stores.push(map<ShipState>({ ...defaultShipState, id: `ship-${i}` }))
    objects.push({ ...defaultShipState, id: `ship-${i}` })
  }

  let idx = 0

  bench('nanostores pool add + remove', () => {
    const i = idx++ % 100
    const $ship = stores[i]
    const id = `ship-${i}`
    $pool.setKey(id, $ship)
    $pool.setKey(id, undefined)
  })

  bench('plain object pool add + remove', () => {
    const i = idx++ % 100
    const ship = objects[i]
    const id = `ship-${i}`
    pool[id] = ship
    delete pool[id]
  })
})

// ---------------------------------------------------------------------------
// 6. Simulated game tick: THREE variants
//    The most important benchmark — this is the actual per-frame workload.
// ---------------------------------------------------------------------------
describe('simulated game tick (50 entities)', () => {
  const ENTITY_COUNT = 50
  const dt = 1 / 60

  // Nanostore entities (for setKey variant)
  const nanoSetKeyEntities: ShipStore[] = []
  for (let i = 0; i < ENTITY_COUNT; i++) {
    nanoSetKeyEntities.push(
      map<ShipState>({
        ...defaultShipState,
        id: `ship-sk-${i}`,
        lat: Math.random() * 180 - 90,
        lng: Math.random() * 360 - 180,
        angularVelocityX: (Math.random() - 0.5) * 2,
        angularVelocityY: (Math.random() - 0.5) * 2,
        angularVelocityZ: (Math.random() - 0.5) * 2,
      })
    )
  }

  // Nanostore entities (for .set() batch variant)
  const nanoBatchEntities: ShipStore[] = []
  for (let i = 0; i < ENTITY_COUNT; i++) {
    nanoBatchEntities.push(
      map<ShipState>({
        ...defaultShipState,
        id: `ship-b-${i}`,
        lat: Math.random() * 180 - 90,
        lng: Math.random() * 360 - 180,
        angularVelocityX: (Math.random() - 0.5) * 2,
        angularVelocityY: (Math.random() - 0.5) * 2,
        angularVelocityZ: (Math.random() - 0.5) * 2,
      })
    )
  }

  // Plain object entities
  const plainEntities: ShipState[] = []
  for (let i = 0; i < ENTITY_COUNT; i++) {
    plainEntities.push({
      ...defaultShipState,
      id: `ship-p-${i}`,
      lat: Math.random() * 180 - 90,
      lng: Math.random() * 360 - 180,
      angularVelocityX: (Math.random() - 0.5) * 2,
      angularVelocityY: (Math.random() - 0.5) * 2,
      angularVelocityZ: (Math.random() - 0.5) * 2,
    })
  }

  bench('nanostores: setKey per field (current app pattern)', () => {
    for (let i = 0; i < ENTITY_COUNT; i++) {
      const $entity = nanoSetKeyEntities[i]
      const state = $entity.get()

      const newLat = state.lat + state.angularVelocityX * dt
      const newLng = state.lng + state.angularVelocityY * dt

      if (state.lat !== newLat) {
        $entity.setKey('lat', newLat)
      }
      if (state.lng !== newLng) {
        $entity.setKey('lng', newLng)
      }
    }
  })

  bench('nanostores: .set() batch (proposed engine pattern)', () => {
    for (let i = 0; i < ENTITY_COUNT; i++) {
      const $entity = nanoBatchEntities[i]
      const state = $entity.get()

      const newLat = state.lat + state.angularVelocityX * dt
      const newLng = state.lng + state.angularVelocityY * dt

      $entity.set({ ...state, lat: newLat, lng: newLng })
    }
  })

  bench('plain objects: direct mutation', () => {
    for (let i = 0; i < ENTITY_COUNT; i++) {
      const entity = plainEntities[i]

      entity.lat = entity.lat + entity.angularVelocityX * dt
      entity.lng = entity.lng + entity.angularVelocityY * dt
    }
  })
})

// ---------------------------------------------------------------------------
// 7. Subscriber overhead: .listen() active during mutations
// ---------------------------------------------------------------------------
describe('.setKey() with active subscriber vs without', () => {
  const $shipNoSub = map<ShipState>({ ...defaultShipState, id: 'no-sub' })
  const $shipWithSub = map<ShipState>({ ...defaultShipState, id: 'with-sub' })

  let subCount = 0
  const unsub = $shipWithSub.listen(() => {
    subCount++
  })

  let tick = 0

  bench('nanostores .setKey() (no subscriber)', () => {
    tick++
    $shipNoSub.setKey('lat', Math.sin(tick * 0.01) * 90)
  })

  bench('nanostores .setKey() (1 subscriber)', () => {
    tick++
    $shipWithSub.setKey('lat', Math.sin(tick * 0.01) * 90)
  })

  void unsub
  void subCount
})

// ---------------------------------------------------------------------------
// 8. Realistic game frame: mixed operations
//    Simulates one full frame: spawn 2 bullets, tick 50 entities, despawn 2.
//    This captures the mixed workload, not just the hot loop.
// ---------------------------------------------------------------------------
describe('realistic game frame (50 entities, 2 spawn, 2 despawn)', () => {
  const ENTITY_COUNT = 50
  const dt = 1 / 60

  // --- Nanostores setup ---
  type NanoPool = Record<string, ShipStore | undefined>
  const $nanoPool = map<NanoPool>({})
  const nanoEntities: ShipStore[] = []
  for (let i = 0; i < ENTITY_COUNT; i++) {
    const $e = map<ShipState>({
      ...defaultShipState,
      id: `n-${i}`,
      lat: Math.random() * 180 - 90,
      lng: Math.random() * 360 - 180,
      angularVelocityX: (Math.random() - 0.5) * 2,
      angularVelocityY: (Math.random() - 0.5) * 2,
      angularVelocityZ: (Math.random() - 0.5) * 2,
    })
    nanoEntities.push($e)
    $nanoPool.setKey(`n-${i}`, $e)
  }
  // Spare stores for spawn/despawn cycling
  const nanoSpares: ShipStore[] = []
  for (let i = 0; i < 100; i++) {
    nanoSpares.push(map<ShipState>({ ...defaultShipState, id: `spare-${i}` }))
  }

  // --- Plain object setup ---
  const plainPool: Record<string, ShipState | undefined> = {}
  const plainEntities: ShipState[] = []
  for (let i = 0; i < ENTITY_COUNT; i++) {
    const e: ShipState = {
      ...defaultShipState,
      id: `p-${i}`,
      lat: Math.random() * 180 - 90,
      lng: Math.random() * 360 - 180,
      angularVelocityX: (Math.random() - 0.5) * 2,
      angularVelocityY: (Math.random() - 0.5) * 2,
      angularVelocityZ: (Math.random() - 0.5) * 2,
    }
    plainEntities.push(e)
    plainPool[`p-${i}`] = e
  }
  const plainSpares: ShipState[] = []
  for (let i = 0; i < 100; i++) {
    plainSpares.push({ ...defaultShipState, id: `spare-${i}` })
  }

  let nanoFrame = 0
  let plainFrame = 0

  bench('nanostores: .set() batch + spawn/despawn', () => {
    const f = nanoFrame++ % 50

    // Despawn 2
    const despawn1 = nanoEntities[f % ENTITY_COUNT]
    const despawn2 = nanoEntities[(f + 1) % ENTITY_COUNT]
    $nanoPool.setKey(despawn1.get().id, undefined)
    $nanoPool.setKey(despawn2.get().id, undefined)

    // Spawn 2
    const spare1 = nanoSpares[f % 100]
    const spare2 = nanoSpares[(f + 1) % 100]
    spare1.set({
      ...defaultShipState,
      id: `spawned-${f}-0`,
      lat: f * 0.1,
      lng: f * 0.2,
      angularVelocityX: 0.5,
      angularVelocityY: 0.3,
      angularVelocityZ: 0,
    })
    spare2.set({
      ...defaultShipState,
      id: `spawned-${f}-1`,
      lat: f * -0.1,
      lng: f * -0.2,
      angularVelocityX: -0.5,
      angularVelocityY: -0.3,
      angularVelocityZ: 0,
    })
    $nanoPool.setKey(spare1.get().id, spare1)
    $nanoPool.setKey(spare2.get().id, spare2)

    // Tick all 50 entities using .set() batch
    for (let i = 0; i < ENTITY_COUNT; i++) {
      const $entity = nanoEntities[i]
      const state = $entity.get()
      $entity.set({
        ...state,
        lat: state.lat + state.angularVelocityX * dt,
        lng: state.lng + state.angularVelocityY * dt,
      })
    }

    // Re-add despawned for next iteration
    $nanoPool.setKey(despawn1.get().id, despawn1)
    $nanoPool.setKey(despawn2.get().id, despawn2)
  })

  bench('plain objects: mutation + spawn/despawn', () => {
    const f = plainFrame++ % 50

    // Despawn 2
    const despawn1 = plainEntities[f % ENTITY_COUNT]
    const despawn2 = plainEntities[(f + 1) % ENTITY_COUNT]
    delete plainPool[despawn1.id]
    delete plainPool[despawn2.id]

    // Spawn 2
    const spare1 = plainSpares[f % 100]
    const spare2 = plainSpares[(f + 1) % 100]
    Object.assign(spare1, defaultShipState, {
      id: `spawned-${f}-0`,
      lat: f * 0.1,
      lng: f * 0.2,
      angularVelocityX: 0.5,
      angularVelocityY: 0.3,
      angularVelocityZ: 0,
    })
    Object.assign(spare2, defaultShipState, {
      id: `spawned-${f}-1`,
      lat: f * -0.1,
      lng: f * -0.2,
      angularVelocityX: -0.5,
      angularVelocityY: -0.3,
      angularVelocityZ: 0,
    })
    plainPool[spare1.id] = spare1
    plainPool[spare2.id] = spare2

    // Tick all 50 entities
    for (let i = 0; i < ENTITY_COUNT; i++) {
      const entity = plainEntities[i]
      entity.lat = entity.lat + entity.angularVelocityX * dt
      entity.lng = entity.lng + entity.angularVelocityY * dt
    }

    // Re-add despawned for next iteration
    plainPool[despawn1.id] = despawn1
    plainPool[despawn2.id] = despawn2
  })
})
