import type { Vec3 } from '@heygrady/hexagonoids-engine'
import {
  createGame,
  ROCK_LARGE_SIZE,
  spawnRock,
  startPlayer,
  unitPointToQuaternion,
  vec3,
} from '@heygrady/hexagonoids-engine'
import { createRNG } from '@neat-evolution/utils'
import { describe, expect, it } from 'vitest'
import { encodeGameState } from '../../src/encoding/encodeGameState.js'
import {
  BULLET_SLOTS,
  CONE_COUNT,
  FEATURES_PER_BULLET,
  FEATURES_PER_CONE,
  FEATURES_PER_ROCK,
  GLOBAL_FEATURES,
  INPUT_COUNT,
} from '../../src/encoding/encodingPresets.js'

const PLAYER_ID = 'player-1'

function pointFromLatLng(lat: number, lng: number): Vec3 {
  const latRad = (lat * Math.PI) / 180
  const lngRad = (lng * Math.PI) / 180
  const cosLat = Math.cos(latRad)
  return vec3(
    cosLat * Math.cos(lngRad),
    Math.sin(latRad),
    cosLat * Math.sin(lngRad)
  )
}

function offsetPoint(
  center: Vec3,
  distanceDegrees: number,
  headingRadians = 0
): Vec3 {
  // Normalize center
  const cx = center[0],
    cy = center[1],
    cz = center[2]
  const len = Math.sqrt(cx * cx + cy * cy + cz * cz)
  const ux = cx / len,
    uy = cy / len,
    uz = cz / len

  // Build tangent plane basis
  const refX = 0,
    refY = Math.abs(uy) > 0.95 ? 0 : 1,
    refZ = Math.abs(uy) > 0.95 ? 1 : 0
  let ex = refY * uz - refZ * uy,
    ey = refZ * ux - refX * uz,
    ez = refX * uy - refY * ux
  const eLen = Math.sqrt(ex * ex + ey * ey + ez * ez)
  ex /= eLen
  ey /= eLen
  ez /= eLen
  const nx = ey * uz - ez * uy,
    ny = ez * ux - ex * uz,
    nz = ex * uy - ey * ux

  // Tangent direction from heading
  const cosH = Math.cos(headingRadians),
    sinH = Math.sin(headingRadians)
  const tx = nx * cosH + ex * sinH,
    ty = ny * cosH + ey * sinH,
    tz = nz * cosH + ez * sinH

  // Rotation axis = cross(up, tangent)
  const ax = uy * tz - uz * ty,
    ay = uz * tx - ux * tz,
    az = ux * ty - uy * tx
  const aLen = Math.sqrt(ax * ax + ay * ay + az * az)
  const kx = ax / aLen,
    ky = ay / aLen,
    kz = az / aLen

  // Rodrigues' rotation: rotate center around axis by distance
  const angle = (distanceDegrees * Math.PI) / 180
  const cosA = Math.cos(angle),
    sinA = Math.sin(angle)
  const dot = kx * ux + ky * uy + kz * uz
  const rx = ux * cosA + (ky * uz - kz * uy) * sinA + kx * dot * (1 - cosA)
  const ry = uy * cosA + (kz * ux - kx * uz) * sinA + ky * dot * (1 - cosA)
  const rz = uz * cosA + (kx * uy - ky * ux) * sinA + kz * dot * (1 - cosA)

  return vec3(rx, ry, rz)
}

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
      undefined,
      undefined,
      undefined,
      engine
    )
    expect(result).toHaveLength(INPUT_COUNT)
    expect(result).toHaveLength(90)
  })

  it('returns all finite numbers', () => {
    const { state, engine } = setupGame('enc-v2-finite', 15)
    const result = encodeGameState(
      state,
      PLAYER_ID,
      undefined,
      undefined,
      undefined,
      engine
    )
    for (const value of result) {
      expect(Number.isFinite(value)).toBe(true)
    }
  })

  it('ship velocity features are normalized to expected ranges', () => {
    const { state, engine } = setupGame('enc-v2-ranges', 20)
    const result = encodeGameState(
      state,
      PLAYER_ID,
      undefined,
      undefined,
      undefined,
      engine
    )

    // velocityX [-1,1]
    expect(result[0]).toBeGreaterThanOrEqual(-1)
    expect(result[0]).toBeLessThanOrEqual(1)

    // velocityY [-1,1]
    expect(result[1]).toBeGreaterThanOrEqual(-1)
    expect(result[1]).toBeLessThanOrEqual(1)
  })

  it('when no rocks are nearby, lidar slots remain zeroed', () => {
    const { state, engine } = setupGame('enc-v2-empty', 0)
    const result = encodeGameState(
      state,
      PLAYER_ID,
      undefined,
      undefined,
      undefined,
      engine
    )

    for (let i = 2; i < result.length; i++) {
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
      undefined,
      undefined,
      undefined,
      engine
    )

    expect(result).toHaveLength(INPUT_COUNT)
    expect(result[0]).toBe(0)
    expect(result[1]).toBe(0)
  })

  it('nearby rock produces non-zero proximity in at least one cone', () => {
    const { state, engine } = setupGame('enc-v2-rock-size', 0)
    const player = state.players.get(PLAYER_ID)
    const ship =
      player?.shipId != null ? state.ships.get(player.shipId) : undefined
    if (ship == null || !ship.alive) {
      throw new Error('Expected alive ship for proximity test')
    }

    spawnRock(
      state,
      offsetPoint(ship.position, 4, 0.4),
      ROCK_LARGE_SIZE,
      createRNG('test')
    )

    const result = encodeGameState(
      state,
      PLAYER_ID,
      undefined,
      undefined,
      undefined,
      engine
    )

    // base+0 is proximity, should be non-zero for nearby rock
    const proximityFeatures: number[] = []
    for (let cone = 0; cone < CONE_COUNT; cone++) {
      const base = GLOBAL_FEATURES + cone * FEATURES_PER_CONE
      proximityFeatures.push(result[base] ?? 0)
    }

    expect(proximityFeatures.some((v) => v > 0.001)).toBe(true)
  })

  it('encodes rock detections into cone slots', () => {
    const { state, engine } = setupGame('enc-v2-cone8-rocks', 0)
    const player = state.players.get(PLAYER_ID)
    const ship =
      player?.shipId != null ? state.ships.get(player.shipId) : undefined
    if (ship == null || !ship.alive) {
      throw new Error('Expected alive ship for cone8 test')
    }

    spawnRock(
      state,
      offsetPoint(ship.position, 4, -0.3),
      ROCK_LARGE_SIZE,
      createRNG('test')
    )

    const result = encodeGameState(
      state,
      PLAYER_ID,
      [],
      undefined,
      undefined,
      engine
    )

    expect(result).toHaveLength(INPUT_COUNT)

    // At least one cone should have a non-zero proximity
    const proximityFeatures: number[] = []
    for (let cone = 0; cone < CONE_COUNT; cone++) {
      const base = GLOBAL_FEATURES + cone * FEATURES_PER_CONE
      proximityFeatures.push(result[base] ?? 0)
    }
    expect(proximityFeatures.some((v) => v > 0.001)).toBe(true)

    // All values should be finite
    for (const value of result) {
      expect(Number.isFinite(value)).toBe(true)
    }
  })

  it('encodes two nearest rocks in the same cone', () => {
    const { state, engine } = setupGame('enc-v2-two-rocks-same-cone', 0)
    const player = state.players.get(PLAYER_ID)
    const ship =
      player?.shipId != null ? state.ships.get(player.shipId) : undefined
    if (ship == null || !ship.alive) {
      throw new Error('Expected alive ship for two-rocks-cone test')
    }

    const heading = 0.2
    spawnRock(
      state,
      offsetPoint(ship.position, 3, heading),
      ROCK_LARGE_SIZE,
      createRNG('test')
    )
    spawnRock(
      state,
      offsetPoint(ship.position, 5, heading),
      ROCK_LARGE_SIZE,
      createRNG('test')
    )

    const result = encodeGameState(
      state,
      PLAYER_ID,
      undefined,
      undefined,
      undefined,
      engine
    )

    let coneWithTwoHits: number | null = null
    for (let cone = 0; cone < CONE_COUNT; cone++) {
      const base = GLOBAL_FEATURES + cone * FEATURES_PER_CONE
      const firstProximity = result[base] ?? 0
      const secondProximity = result[base + FEATURES_PER_ROCK] ?? 0
      if (firstProximity > 0 && secondProximity > 0) {
        coneWithTwoHits = cone
        expect(firstProximity).toBeGreaterThanOrEqual(secondProximity)
        break
      }
    }

    expect(coneWithTwoHits).not.toBeNull()
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
      const point = pointFromLatLng(start.lat, start.lng)
      ship.position[0] = point[0]
      ship.position[1] = point[1]
      ship.position[2] = point[2]
      ship.yaw = start.yaw
      ship.orientation = unitPointToQuaternion(point[0], point[1], point[2])

      const result = encodeGameState(
        state,
        PLAYER_ID,
        undefined,
        undefined,
        undefined,
        engine
      )
      for (const value of result) {
        expect(Number.isFinite(value)).toBe(true)
      }
      // Ship velocity should be bounded
      expect(result[0]).toBeGreaterThanOrEqual(-1)
      expect(result[0]).toBeLessThanOrEqual(1)
      expect(result[1]).toBeGreaterThanOrEqual(-1)
      expect(result[1]).toBeLessThanOrEqual(1)
    }
  })

  it('bullet slots are zero when no bullets exist', () => {
    const { state, engine } = setupGame('enc-bullets-empty', 0)
    const result = encodeGameState(
      state,
      PLAYER_ID,
      undefined,
      undefined,
      undefined,
      engine
    )

    const bulletBase = GLOBAL_FEATURES + CONE_COUNT * FEATURES_PER_CONE
    for (let i = 0; i < BULLET_SLOTS * FEATURES_PER_BULLET; i++) {
      expect(result[bulletBase + i]).toBe(0)
    }
  })

  it('bullet slots encode fired bullets', () => {
    const { state, engine } = setupGame('enc-bullets-fire', 5)

    // Fire a bullet by ticking with fire=true
    engine.tick(
      { [PLAYER_ID]: { thrust: false, fire: true, left: false, right: false } },
      33
    )
    // Advance one more tick so the bullet has moved
    engine.tick(
      {
        [PLAYER_ID]: { thrust: false, fire: false, left: false, right: false },
      },
      33
    )

    expect(state.bullets.size).toBeGreaterThan(0)

    const result = encodeGameState(
      state,
      PLAYER_ID,
      undefined,
      undefined,
      undefined,
      engine
    )

    // Slot 0 should have non-zero proximity (bullet is near ship)
    const bulletBase = GLOBAL_FEATURES + CONE_COUNT * FEATURES_PER_CONE
    const proximity0 = result[bulletBase]!
    expect(proximity0).not.toBe(0)
    // All bullet values should be finite
    for (let i = 0; i < BULLET_SLOTS * FEATURES_PER_BULLET; i++) {
      expect(Number.isFinite(result[bulletBase + i])).toBe(true)
    }
  })

  it('bullets ordered oldest first', () => {
    const { state, engine } = setupGame('enc-bullets-order', 5)

    // Fire first bullet
    engine.tick(
      { [PLAYER_ID]: { thrust: false, fire: true, left: false, right: false } },
      33
    )

    // Advance past cooldown (150ms = ~5 ticks at 33ms)
    for (let i = 0; i < 6; i++) {
      engine.tick(
        {
          [PLAYER_ID]: {
            thrust: false,
            fire: false,
            left: false,
            right: false,
          },
        },
        33
      )
    }

    // Fire second bullet
    engine.tick(
      { [PLAYER_ID]: { thrust: false, fire: true, left: false, right: false } },
      33
    )

    expect(state.bullets.size).toBeGreaterThanOrEqual(2)

    const result = encodeGameState(
      state,
      PLAYER_ID,
      undefined,
      undefined,
      undefined,
      engine
    )

    const bulletBase = GLOBAL_FEATURES + CONE_COUNT * FEATURES_PER_CONE
    const proximity0 = result[bulletBase]!
    const proximity1 = result[bulletBase + FEATURES_PER_BULLET]!

    // Both slots should have non-zero values
    expect(proximity0).not.toBe(0)
    expect(proximity1).not.toBe(0)

    // Slot 0 is the older bullet (farther away = lower proximity)
    // Slot 1 is the newer bullet (closer = higher proximity)
    expect(proximity0).toBeLessThan(proximity1)
  })
})
