import {
  createGame,
  greatCircleDistance,
  latLngToQuaternion,
  RADIUS,
  ROCK_LARGE_SIZE,
  spawnRock,
  startPlayer,
} from '@heygrady/hexagonoids-engine'
import { describe, expect, it } from 'vitest'
import { buildRockPerceptionPrecompute } from '../../src/encoding/collectObservations.js'
import {
  encodeGameState,
  INPUT_COUNT,
} from '../../src/encoding/encodeGameState.js'
import { getInputCountForEncoding } from '../../src/encoding/encodingPresets.js'

const PLAYER_ID = 'player-1'

function setupGame(seed: string, ticks = 0) {
  const engine = createGame({ seed })
  const { state, rng } = engine
  startPlayer(state, PLAYER_ID, rng)

  for (let i = 0; i < ticks; i++) {
    engine.tick(
      {
        [PLAYER_ID]: { thrust: false, fire: false, left: false, right: false },
      },
      33
    )
  }

  return { state, engine }
}

describe('encodeGameState', () => {
  it('returns exactly the configured input count', () => {
    const { state, engine } = setupGame('enc-v2-length', 5)
    const result = encodeGameState(
      state,
      PLAYER_ID,
      new Map(),
      new Map(),
      33,
      undefined,
      undefined,
      undefined,
      undefined,
      engine
    )
    expect(result).toHaveLength(INPUT_COUNT)
    expect(result).toHaveLength(69)
  })

  it('returns all finite numbers', () => {
    const { state, engine } = setupGame('enc-v2-finite', 15)
    const result = encodeGameState(
      state,
      PLAYER_ID,
      new Map(),
      new Map(),
      33,
      undefined,
      undefined,
      undefined,
      undefined,
      engine
    )
    for (const value of result) {
      expect(Number.isFinite(value)).toBe(true)
    }
  })

  it('global features are normalized to expected ranges', () => {
    const { state, engine } = setupGame('enc-v2-ranges', 20)
    const result = encodeGameState(
      state,
      PLAYER_ID,
      new Map(),
      new Map(),
      33,
      undefined,
      undefined,
      undefined,
      undefined,
      engine
    )

    expect(result[0]).toBeGreaterThanOrEqual(0)
    expect(result[0]).toBeLessThanOrEqual(1)

    expect(result[1]).toBeGreaterThanOrEqual(-1)
    expect(result[1]).toBeLessThanOrEqual(1)
    expect(result[2]).toBeGreaterThanOrEqual(-1)
    expect(result[2]).toBeLessThanOrEqual(1)

    expect(result[3]).toBeGreaterThanOrEqual(0)
    expect(result[3]).toBeLessThanOrEqual(1)
    expect(result[4]).toBeGreaterThanOrEqual(0)
    expect(result[4]).toBeLessThanOrEqual(1)
  })

  it('when no rocks are nearby, lidar slots remain zeroed', () => {
    const { state, engine } = setupGame('enc-v2-empty', 0)
    const result = encodeGameState(
      state,
      PLAYER_ID,
      new Map(),
      new Map(),
      33,
      undefined,
      undefined,
      undefined,
      undefined,
      engine
    )

    for (let i = 5; i < result.length; i++) {
      expect(result[i]).toBe(0)
    }
  })

  it('dead ship returns stable fallback vector shape', () => {
    const { state, engine } = setupGame('enc-v2-dead', 1)
    const player = state.players.get(PLAYER_ID)
    const ship =
      player?.shipId != null ? state.ships.get(player.shipId) : undefined
    if (ship != null) ship.alive = false

    const result = encodeGameState(
      state,
      PLAYER_ID,
      new Map(),
      new Map(),
      33,
      undefined,
      undefined,
      undefined,
      undefined,
      engine
    )

    expect(result).toHaveLength(INPUT_COUNT)
    expect(result[0]).toBe(0)
    expect(result[3]).toBe(0)
  })

  it('uses previous distances to produce non-zero closing features', () => {
    const { state, engine } = setupGame('enc-v2-closing', 5)
    const player = state.players.get(PLAYER_ID)
    const ship =
      player?.shipId != null ? state.ships.get(player.shipId) : undefined
    if (ship == null || !ship.alive) {
      throw new Error('Expected alive ship for closing-speed test')
    }

    // Force at least one local rock in SOI so closing features are populated.
    spawnRock(state, ship.lat, ship.lng + 4, ROCK_LARGE_SIZE, {
      gen: () => 0.5,
      genRange: (min: number, _max: number) => min,
      genBool: () => true,
    })

    const prevDistances = new Map<string, number>()
    for (const rock of state.rocks.values()) {
      const dist = greatCircleDistance(
        ship.lat,
        ship.lng,
        rock.lat,
        rock.lng,
        RADIUS
      )
      prevDistances.set(rock.id, dist + 0.08)
    }

    const result = encodeGameState(
      state,
      PLAYER_ID,
      new Map(),
      prevDistances,
      33,
      undefined,
      undefined,
      undefined,
      undefined,
      engine
    )

    const closingFeatures: number[] = []
    for (let ray = 0; ray < 16; ray++) {
      const base = 5 + ray * 4
      closingFeatures.push(result[base + 1] ?? 0)
    }
    expect(closingFeatures.some((v) => Math.abs(v) > 0.0001)).toBe(true)
  })

  it('encodes rock size in the third lidar channel', () => {
    const { state, engine } = setupGame('enc-v2-rock-size', 0)
    const player = state.players.get(PLAYER_ID)
    const ship =
      player?.shipId != null ? state.ships.get(player.shipId) : undefined
    if (ship == null || !ship.alive) {
      throw new Error('Expected alive ship for rock-size test')
    }

    spawnRock(state, ship.lat, ship.lng + 4, ROCK_LARGE_SIZE, {
      gen: () => 0.5,
      genRange: (min: number, _max: number) => min,
      genBool: () => true,
    })

    const result = encodeGameState(
      state,
      PLAYER_ID,
      new Map(),
      new Map(),
      33,
      undefined,
      undefined,
      undefined,
      undefined,
      engine
    )

    const sizeFeatures: number[] = []
    for (let ray = 0; ray < 16; ray++) {
      const base = 5 + ray * 4
      sizeFeatures.push(result[base + 2] ?? 0)
    }

    expect(sizeFeatures.some((v) => v > 0.99)).toBe(true)
  })

  it('supports the six-value encoding preset', () => {
    const { state, engine } = setupGame('enc-v2-six-preset', 0)
    const player = state.players.get(PLAYER_ID)
    const ship =
      player?.shipId != null ? state.ships.get(player.shipId) : undefined
    if (ship == null || !ship.alive) {
      throw new Error('Expected alive ship for six-preset test')
    }

    spawnRock(state, ship.lat + 2, ship.lng + 6, ROCK_LARGE_SIZE, {
      gen: () => 0.5,
      genRange: (min: number, _max: number) => min,
      genBool: () => true,
    })
    const perception = buildRockPerceptionPrecompute(
      {
        x: ship.x ?? 0,
        y: ship.y ?? 1,
        z: ship.z ?? 0,
      },
      Math.PI / 2 + ship.yaw,
      engine
    )
    const prevProjections = new Map<string, [number, number]>()
    for (const rock of perception.rocks) {
      prevProjections.set(rock.id, [rock.localX - 0.08, rock.localY])
    }

    const result = encodeGameState(
      state,
      PLAYER_ID,
      prevProjections,
      new Map(),
      33,
      [],
      undefined,
      undefined,
      'six',
      engine
    )

    expect(result).toHaveLength(getInputCountForEncoding('six'))
    expect(result).toHaveLength(101)

    const driftFeatures: number[] = []
    for (let ray = 0; ray < 16; ray++) {
      const base = 5 + ray * 6
      driftFeatures.push(result[base + 5] ?? 0)
    }
    expect(driftFeatures.some((v) => Math.abs(v) > 0.0001)).toBe(true)
  })

  it('supports the five-value encoding preset', () => {
    const { state, engine } = setupGame('enc-v2-five-preset', 0)
    const result = encodeGameState(
      state,
      PLAYER_ID,
      new Map(),
      new Map(),
      33,
      [],
      undefined,
      undefined,
      'five',
      engine
    )

    expect(result).toHaveLength(getInputCountForEncoding('five'))
    expect(result).toHaveLength(85)
  })

  it('supports the cone8 encoding preset with 37 inputs', () => {
    const { state, engine } = setupGame('enc-v2-cone8-preset', 0)
    const result = encodeGameState(
      state,
      PLAYER_ID,
      new Map(),
      new Map(),
      33,
      [],
      undefined,
      undefined,
      'cone8',
      engine
    )

    expect(result).toHaveLength(getInputCountForEncoding('cone8'))
    expect(result).toHaveLength(37)
  })

  it('cone8 encodes rock detections into cone slots', () => {
    const { state, engine } = setupGame('enc-v2-cone8-rocks', 0)
    const player = state.players.get(PLAYER_ID)
    const ship =
      player?.shipId != null ? state.ships.get(player.shipId) : undefined
    if (ship == null || !ship.alive) {
      throw new Error('Expected alive ship for cone8 test')
    }

    spawnRock(state, ship.lat, ship.lng + 4, ROCK_LARGE_SIZE, {
      gen: () => 0.5,
      genRange: (min: number, _max: number) => min,
      genBool: () => true,
    })

    const result = encodeGameState(
      state,
      PLAYER_ID,
      new Map(),
      new Map(),
      33,
      [],
      undefined,
      undefined,
      'cone8',
      engine
    )

    expect(result).toHaveLength(37)

    // At least one cone should have a non-zero proximity (inverse distance)
    const proximityFeatures: number[] = []
    for (let cone = 0; cone < 8; cone++) {
      const base = 5 + cone * 4
      proximityFeatures.push(result[base] ?? 0)
    }
    expect(proximityFeatures.some((v) => v > 0.001)).toBe(true)

    // All values should be finite
    for (const value of result) {
      expect(Number.isFinite(value)).toBe(true)
    }
  })

  it('remains finite and bounded for pole-adjacent ship states', () => {
    const { state, engine } = setupGame('enc-v2-poles', 0)
    const player = state.players.get(PLAYER_ID)
    const ship =
      player?.shipId != null ? state.ships.get(player.shipId) : undefined
    if (ship == null || !ship.alive) {
      throw new Error('Expected alive ship for pole-encoding test')
    }

    const starts = [
      { lat: 89.95, lng: 0, yaw: 0 },
      { lat: 89.95, lng: 179.9, yaw: Math.PI / 2 },
      { lat: -89.95, lng: -120, yaw: -Math.PI / 2 },
      { lat: -89.95, lng: 45, yaw: Math.PI },
    ]

    for (const start of starts) {
      ship.lat = start.lat
      ship.lng = start.lng
      ship.yaw = start.yaw
      ship.orientation = latLngToQuaternion(start.lat, start.lng)

      const result = encodeGameState(
        state,
        PLAYER_ID,
        new Map(),
        new Map(),
        33,
        undefined,
        undefined,
        undefined,
        undefined,
        engine
      )
      for (const value of result) {
        expect(Number.isFinite(value)).toBe(true)
      }
      expect(result[1]).toBeGreaterThanOrEqual(-1)
      expect(result[1]).toBeLessThanOrEqual(1)
      expect(result[2]).toBeGreaterThanOrEqual(-1)
      expect(result[2]).toBeLessThanOrEqual(1)
    }
  })
})
