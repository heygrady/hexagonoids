import { Quaternion, Vector3 } from '@babylonjs/core/Maths/math.vector.js'
import {
  createGame,
  ROCK_LARGE_SIZE,
  spawnRock,
  startPlayer,
  unitPointToQuaternion,
} from '@heygrady/hexagonoids-engine'
import { describe, expect, it } from 'vitest'
import { encodeGameState } from '../../src/encoding/encodeGameState.js'
import { INPUT_COUNT } from '../../src/encoding/encodingPresets.js'

const PLAYER_ID = 'player-1'

function pointFromLatLng(lat: number, lng: number) {
  const latRad = (lat * Math.PI) / 180
  const lngRad = (lng * Math.PI) / 180
  const cosLat = Math.cos(latRad)
  return {
    x: cosLat * Math.cos(lngRad),
    y: Math.sin(latRad),
    z: cosLat * Math.sin(lngRad),
  }
}

function offsetPoint(
  center: { x: number; y: number; z: number },
  distanceDegrees: number,
  headingRadians = 0
) {
  const up = new Vector3(center.x, center.y, center.z).normalize()
  const reference = Math.abs(up.y) > 0.95 ? Vector3.Right() : Vector3.Up()
  const east = Vector3.Cross(reference, up).normalize()
  const north = Vector3.Cross(up, east).normalize()
  const tangent = east
    .scale(Math.cos(headingRadians))
    .addInPlace(north.scale(Math.sin(headingRadians)))
    .normalize()
  const axis = Vector3.Cross(up, tangent).normalize()
  const rotated = up.applyRotationQuaternion(
    Quaternion.RotationAxis(axis, (distanceDegrees * Math.PI) / 180)
  )
  rotated.normalize()
  return {
    x: rotated.x,
    y: rotated.y,
    z: rotated.z,
  }
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
    expect(result).toHaveLength(34)
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

    spawnRock(state, offsetPoint(ship, 4, 0.4), ROCK_LARGE_SIZE, {
      gen: () => 0.5,
      genRange: (min: number, _max: number) => min,
      genBool: () => true,
    })

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
    for (let cone = 0; cone < 8; cone++) {
      const base = 2 + cone * 4
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

    spawnRock(state, offsetPoint(ship, 4, -0.3), ROCK_LARGE_SIZE, {
      gen: () => 0.5,
      genRange: (min: number, _max: number) => min,
      genBool: () => true,
    })

    const result = encodeGameState(
      state,
      PLAYER_ID,
      [],
      undefined,
      undefined,
      engine
    )

    expect(result).toHaveLength(34)

    // At least one cone should have a non-zero proximity
    const proximityFeatures: number[] = []
    for (let cone = 0; cone < 8; cone++) {
      const base = 2 + cone * 4
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
      const point = pointFromLatLng(start.lat, start.lng)
      ship.x = point.x
      ship.y = point.y
      ship.z = point.z
      ship.yaw = start.yaw
      ship.orientation = unitPointToQuaternion(point.x, point.y, point.z)

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
})
