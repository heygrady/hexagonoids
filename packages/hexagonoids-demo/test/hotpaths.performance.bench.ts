import {
  createGame,
  detectCollisions,
  greatCircleDistance,
  spawnBullet,
  spawnRock,
  startPlayer,
} from '@heygrady/hexagonoids-engine'
import {
  collectObservations,
  doNothingAgent,
  encodeGameState,
  getInputCountForEncoding,
  simulateGame,
} from '@heygrady/hexagonoids-environment'
import { bench, describe } from 'vitest'

const PLAYER_ID = 'player-1'

function createDenseScenario() {
  const engine = createGame({ seed: 'hotpath-bench-v1' })
  const { state, rng } = engine
  startPlayer(state, PLAYER_ID, rng)
  const player = state.players.get(PLAYER_ID)
  if (player?.shipId == null) {
    throw new Error('Expected player ship to exist')
  }
  const ship = state.ships.get(player.shipId)
  if (ship == null) {
    throw new Error('Expected ship to exist')
  }

  for (let i = 0; i < 72; i++) {
    const lat = -30 + (i % 12) * 5
    const lng = -150 + Math.floor(i / 12) * 25
    const size = (i % 3) as 0 | 1 | 2
    spawnRock(state, lat, lng, size, rng)
  }

  for (let i = 0; i < 28; i++) {
    ship.yaw = (i / 28) * Math.PI * 2
    spawnBullet(state, ship, rng)
  }

  const prevProjections = new Map<string, [number, number]>()
  const prevDistances = new Map<string, number>()
  for (const rock of state.rocks.values()) {
    prevProjections.set(rock.id, [0, 0])
    prevDistances.set(
      rock.id,
      greatCircleDistance(ship.lat, ship.lng, rock.lat, rock.lng, 5)
    )
  }

  return { engine, state, prevProjections, prevDistances, rng }
}

function createInVisionRingScenario() {
  const engine = createGame({ seed: 'hotpath-bench-vision-v1' })
  const { state, rng } = engine
  startPlayer(state, PLAYER_ID, rng)
  const player = state.players.get(PLAYER_ID)
  if (player?.shipId == null) {
    throw new Error('Expected player ship to exist')
  }
  const ship = state.ships.get(player.shipId)
  if (ship == null) {
    throw new Error('Expected ship to exist')
  }

  ship.lat = 0
  ship.lng = 0
  ship.yaw = 0

  for (let ring = 0; ring < 3; ring++) {
    const latOffset = (ring - 1) * 3
    for (let i = 0; i < 16; i++) {
      const lngOffset = -20 + i * 2.5
      spawnRock(state, latOffset, lngOffset, (i % 3) as 0 | 1 | 2, rng)
    }
  }

  const prevProjections = new Map<string, [number, number]>()
  const prevDistances = new Map<string, number>()
  for (const rock of state.rocks.values()) {
    prevProjections.set(rock.id, [0, 0])
    prevDistances.set(
      rock.id,
      greatCircleDistance(ship.lat, ship.lng, rock.lat, rock.lng, 5)
    )
  }

  return { engine, state, prevProjections, prevDistances }
}

function createBulletCollisionScenario() {
  const scenario = createDenseScenario()
  for (const ship of scenario.state.ships.values()) {
    ship.alive = false
  }
  return scenario
}

function createShipCollisionScenario() {
  const scenario = createDenseScenario()
  scenario.state.bullets.clear()
  return scenario
}

describe('hotpath performance', () => {
  const BENCH_ITERATIONS = 8
  const BENCH_WARMUP = 2

  bench(
    'detectCollisions dense scene',
    () => {
      const { engine, state } = createDenseScenario()
      for (let i = 0; i < 240; i++) {
        engine.invalidateSpatialIndex()
        detectCollisions(state, undefined, engine)
      }
    },
    {
      iterations: BENCH_ITERATIONS,
      warmupIterations: BENCH_WARMUP,
      time: 0,
      warmupTime: 0,
    }
  )

  bench(
    'detectCollisions bullet-only dense scene',
    () => {
      const { engine, state } = createBulletCollisionScenario()
      for (let i = 0; i < 240; i++) {
        engine.invalidateSpatialIndex()
        detectCollisions(state, undefined, engine)
      }
    },
    {
      iterations: BENCH_ITERATIONS,
      warmupIterations: BENCH_WARMUP,
      time: 0,
      warmupTime: 0,
    }
  )

  bench(
    'detectCollisions ship-only dense scene',
    () => {
      const { engine, state } = createShipCollisionScenario()
      for (let i = 0; i < 240; i++) {
        engine.invalidateSpatialIndex()
        detectCollisions(state, undefined, engine)
      }
    },
    {
      iterations: BENCH_ITERATIONS,
      warmupIterations: BENCH_WARMUP,
      time: 0,
      warmupTime: 0,
    }
  )

  bench(
    'collectObservations dense scene',
    () => {
      const { engine, state, prevProjections, prevDistances } =
        createDenseScenario()
      for (let i = 0; i < 240; i++) {
        collectObservations(
          state,
          PLAYER_ID,
          prevProjections,
          prevDistances,
          33,
          undefined,
          undefined,
          'four',
          engine
        )
      }
    },
    {
      iterations: BENCH_ITERATIONS,
      warmupIterations: BENCH_WARMUP,
      time: 0,
      warmupTime: 0,
    }
  )

  bench(
    'collectObservations in-vision ring scene (bearingOffset hot path)',
    () => {
      const { engine, state, prevProjections, prevDistances } =
        createInVisionRingScenario()
      for (let i = 0; i < 240; i++) {
        collectObservations(
          state,
          PLAYER_ID,
          prevProjections,
          prevDistances,
          33,
          undefined,
          undefined,
          'four',
          engine
        )
      }
    },
    {
      iterations: BENCH_ITERATIONS,
      warmupIterations: BENCH_WARMUP,
      time: 0,
      warmupTime: 0,
    }
  )

  bench(
    'encodeGameState dense scene',
    () => {
      const { engine, state, prevProjections, prevDistances } =
        createDenseScenario()
      const inputBuffer = new Array<number>(getInputCountForEncoding('four'))
      for (let i = 0; i < 240; i++) {
        encodeGameState(
          state,
          PLAYER_ID,
          prevProjections,
          prevDistances,
          33,
          inputBuffer,
          undefined,
          undefined,
          undefined,
          engine
        )
      }
    },
    {
      iterations: BENCH_ITERATIONS,
      warmupIterations: BENCH_WARMUP,
      time: 0,
      warmupTime: 0,
    }
  )

  bench(
    'encodeGameState in-vision ring scene (four)',
    () => {
      const { engine, state, prevProjections, prevDistances } =
        createInVisionRingScenario()
      const inputBuffer = new Array<number>(getInputCountForEncoding('four'))
      for (let i = 0; i < 240; i++) {
        encodeGameState(
          state,
          PLAYER_ID,
          prevProjections,
          prevDistances,
          33,
          inputBuffer,
          undefined,
          undefined,
          'four',
          engine
        )
      }
    },
    {
      iterations: BENCH_ITERATIONS,
      warmupIterations: BENCH_WARMUP,
      time: 0,
      warmupTime: 0,
    }
  )

  bench(
    'collectObservations in-vision ring scene (six tangent-plane drift)',
    () => {
      const { engine, state, prevProjections, prevDistances } =
        createInVisionRingScenario()
      for (let i = 0; i < 240; i++) {
        collectObservations(
          state,
          PLAYER_ID,
          prevProjections,
          prevDistances,
          33,
          undefined,
          undefined,
          'six',
          engine
        )
      }
    },
    {
      iterations: BENCH_ITERATIONS,
      warmupIterations: BENCH_WARMUP,
      time: 0,
      warmupTime: 0,
    }
  )

  bench(
    'engine step dense scene',
    () => {
      const { engine } = createDenseScenario()
      const inputs = {
        [PLAYER_ID]: {
          left: false,
          right: false,
          thrust: true,
          fire: false,
        },
      }
      for (let i = 0; i < 240; i++) {
        engine.tick(inputs, 33)
      }
    },
    {
      iterations: BENCH_ITERATIONS,
      warmupIterations: BENCH_WARMUP,
      time: 0,
      warmupTime: 0,
    }
  )

  bench(
    'simulateGame short episode',
    () => {
      simulateGame(
        doNothingAgent,
        { maxTicks: 400, dtMs: 33, useFastThrust: true },
        'hotpath-sim-v1'
      )
    },
    {
      iterations: BENCH_ITERATIONS,
      warmupIterations: BENCH_WARMUP,
      time: 0,
      warmupTime: 0,
    }
  )
})
