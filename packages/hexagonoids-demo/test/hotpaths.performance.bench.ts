import {
  createGame,
  detectCollisions,
  greatCircleDistance,
  spawnBullet,
  spawnRock,
  startPlayer,
  step,
} from '@heygrady/hexagonoids-engine'
import {
  collectObservations,
  doNothingAgent,
  encodeGameState,
  simulateGame,
} from '@heygrady/hexagonoids-environment'
import { bench, describe } from 'vitest'

const PLAYER_ID = 'player-1'

function createDenseScenario() {
  const { state, rng } = createGame({ seed: 'hotpath-bench-v1' })
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

  const prevDistances = new Map<string, number>()
  for (const rock of state.rocks.values()) {
    prevDistances.set(
      `rock:${rock.id}`,
      greatCircleDistance(ship.lat, ship.lng, rock.lat, rock.lng, 5)
    )
  }
  for (const bullet of state.bullets.values()) {
    prevDistances.set(
      `bullet:${bullet.id}`,
      greatCircleDistance(ship.lat, ship.lng, bullet.lat, bullet.lng, 5)
    )
  }

  return { state, prevDistances, rng }
}

describe('hotpath performance', () => {
  const BENCH_ITERATIONS = 8
  const BENCH_WARMUP = 2

  bench(
    'detectCollisions dense scene',
    () => {
      const { state } = createDenseScenario()
      for (let i = 0; i < 240; i++) {
        detectCollisions(state)
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
      const { state, prevDistances } = createDenseScenario()
      for (let i = 0; i < 240; i++) {
        collectObservations(state, PLAYER_ID, prevDistances, 33)
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
      const { state, prevDistances } = createDenseScenario()
      const inputBuffer = new Array<number>(133)
      for (let i = 0; i < 240; i++) {
        encodeGameState(state, PLAYER_ID, prevDistances, 33, inputBuffer)
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
      const { state, rng } = createDenseScenario()
      const inputs = {
        [PLAYER_ID]: {
          left: false,
          right: false,
          thrust: true,
          fire: false,
        },
      }
      for (let i = 0; i < 240; i++) {
        step(state, inputs, 33, rng)
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
