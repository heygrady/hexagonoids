import {
  createGame,
  detectCollisions,
  spawnBullet,
  spawnRock,
  startPlayer,
  vec3,
} from '@heygrady/hexagonoids-engine'
import {
  collectObservations,
  doNothingAgent,
  encodeGameState,
  INPUT_COUNT,
  simulateGame,
} from '@heygrady/hexagonoids-environment'
import { bench, describe } from 'vitest'

const PLAYER_ID = 'player-1'

function latLngToPoint(lat: number, lng: number) {
  const latRad = (lat * Math.PI) / 180
  const lngRad = (lng * Math.PI) / 180
  const cosLat = Math.cos(latRad)
  return vec3(
    cosLat * Math.cos(lngRad),
    Math.sin(latRad),
    cosLat * Math.sin(lngRad)
  )
}

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
    spawnRock(state, latLngToPoint(lat, lng), size, rng)
  }

  for (let i = 0; i < 28; i++) {
    ship.yaw = (i / 28) * Math.PI * 2
    spawnBullet(state, ship, rng)
  }

  return { engine, state, rng }
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

  // Place ship at (0,0) in lat/lng space
  const origin = latLngToPoint(0, 0)
  ship.position[0] = origin[0]
  ship.position[1] = origin[1]
  ship.position[2] = origin[2]
  ship.yaw = 0

  for (let ring = 0; ring < 3; ring++) {
    const latOffset = (ring - 1) * 3
    for (let i = 0; i < 16; i++) {
      const lngOffset = -20 + i * 2.5
      spawnRock(
        state,
        latLngToPoint(latOffset, lngOffset),
        (i % 3) as 0 | 1 | 2,
        rng
      )
    }
  }

  return { engine, state }
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
      const { engine, state } = createDenseScenario()
      for (let i = 0; i < 240; i++) {
        collectObservations(state, PLAYER_ID, undefined, undefined, engine)
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
      const { engine, state } = createInVisionRingScenario()
      for (let i = 0; i < 240; i++) {
        collectObservations(state, PLAYER_ID, undefined, undefined, engine)
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
      const { engine, state } = createDenseScenario()
      const inputBuffer = new Array<number>(INPUT_COUNT)
      for (let i = 0; i < 240; i++) {
        encodeGameState(
          state,
          PLAYER_ID,
          inputBuffer,
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
    'encodeGameState in-vision ring scene',
    () => {
      const { engine, state } = createInVisionRingScenario()
      const inputBuffer = new Array<number>(INPUT_COUNT)
      for (let i = 0; i < 240; i++) {
        encodeGameState(
          state,
          PLAYER_ID,
          inputBuffer,
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
        { maxTicks: 400, dtMs: 33 },
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
