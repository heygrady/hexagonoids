import {
  createGame,
  type PlayerInputs,
  resetIdCounter,
  startPlayer,
  step,
} from '@heygrady/hexagonoids-engine'
import { describe, expect, it } from 'vitest'

import { randomAgent } from '../../src/agents/randomAgent.js'
import type { AgentContext } from '../../src/agents/types.js'
import { captureSnapshot } from '../../src/scenarios/captureSnapshot.js'
import {
  angularVelocityToHeadingSpeed,
  decodeScenarioBankDocument,
  encodeScenarioBankDocument,
  headingSpeedToAngularVelocity,
} from '../../src/scenarios/codec.js'
import type { ScenarioSnapshot } from '../../src/scenarios/types.js'

const PLAYER_ID = 'player-1'

function createTestSnapshot(seed: string, ticks = 50): ScenarioSnapshot {
  resetIdCounter()
  const { state, rng } = createGame({ seed, useFastThrust: true })
  startPlayer(state, PLAYER_ID, rng)

  const context: AgentContext = { rng, memory: {} }
  const stepInputs: PlayerInputs = {
    [PLAYER_ID]: { left: false, right: false, thrust: false, fire: false },
  }

  let lastSnapshot = captureSnapshot(state, PLAYER_ID, {
    id: `codec-test-${seed}`,
  })
  for (let i = 0; i < ticks; i++) {
    if (state.endedAt != null) break
    const inputs = randomAgent(state, PLAYER_ID, context)
    stepInputs[PLAYER_ID] = inputs
    step(state, stepInputs, 33, rng)

    const player = state.players.get(PLAYER_ID)
    const ship =
      player?.shipId != null ? state.ships.get(player.shipId) : undefined
    if (ship != null && ship.alive) {
      lastSnapshot = captureSnapshot(state, PLAYER_ID, {
        id: `codec-test-${seed}`,
      })
    }
  }

  return lastSnapshot
}

describe('compact-v4 codec', () => {
  it('round-trips a snapshot through encode/decode', () => {
    const snapshot = createTestSnapshot('codec-roundtrip-1')
    expect(snapshot.rocks.length).toBeGreaterThan(0)

    const encoded = encodeScenarioBankDocument([snapshot])
    expect(encoded.version).toBe(5)
    expect(encoded.format).toBe('compact-v5')

    const decoded = decodeScenarioBankDocument(encoded)
    expect(decoded).toHaveLength(1)

    const result = decoded[0]!
    expect(result.id).toBe(snapshot.id)
    expect(result.difficulty).toBeCloseTo(snapshot.difficulty, 3)
    expect(result.gameTime).toBeCloseTo(snapshot.gameTime, 3)
    expect(result.wave).toBe(snapshot.wave)

    // Ship
    expect(result.ship.x).toBeCloseTo(snapshot.ship.x, 3)
    expect(result.ship.y).toBeCloseTo(snapshot.ship.y, 3)
    expect(result.ship.z).toBeCloseTo(snapshot.ship.z, 3)
    expect(result.ship.yaw).toBeCloseTo(snapshot.ship.yaw, 3)
    expect(result.ship.alive).toBe(snapshot.ship.alive)
    expect(result.ship.firedAt).toBe(snapshot.ship.firedAt)

    // Player
    expect(result.player.score).toBe(snapshot.player.score)
    expect(result.player.lives).toBe(snapshot.player.lives)
    expect(result.player.alive).toBe(snapshot.player.alive)

    // Rocks
    expect(result.rocks.length).toBe(snapshot.rocks.length)
    for (let i = 0; i < snapshot.rocks.length; i++) {
      const expected = snapshot.rocks[i]!
      const actual = result.rocks[i]!
      expect(actual.x).toBeCloseTo(expected.x, 3)
      expect(actual.y).toBeCloseTo(expected.y, 3)
      expect(actual.z).toBeCloseTo(expected.z, 3)
      expect(actual.size).toBe(expected.size)
      expect(actual.value).toBe(expected.value)
    }
  })

  it('uses heading+speed for velocity with acceptable precision', () => {
    const snapshot = createTestSnapshot('codec-velocity-1')

    const encoded = encodeScenarioBankDocument([snapshot])
    const decoded = decodeScenarioBankDocument(encoded)
    const result = decoded[0]!

    // Ship angular velocity should round-trip through heading+speed
    expect(result.ship.angularVelocityX).toBeCloseTo(
      snapshot.ship.angularVelocityX,
      3
    )
    expect(result.ship.angularVelocityY).toBeCloseTo(
      snapshot.ship.angularVelocityY,
      3
    )
    expect(result.ship.angularVelocityZ).toBeCloseTo(
      snapshot.ship.angularVelocityZ,
      3
    )

    // Rock angular velocities
    for (let i = 0; i < snapshot.rocks.length; i++) {
      const expected = snapshot.rocks[i]!
      const actual = result.rocks[i]!
      expect(actual.angularVelocityX).toBeCloseTo(expected.angularVelocityX, 3)
      expect(actual.angularVelocityY).toBeCloseTo(expected.angularVelocityY, 3)
      expect(actual.angularVelocityZ).toBeCloseTo(expected.angularVelocityZ, 3)
    }
  })

  it('round-trips bullets', () => {
    // Use a snapshot that has bullets (fire heavily)
    resetIdCounter()
    const { state, rng } = createGame({
      seed: 'codec-bullets',
      useFastThrust: true,
    })
    startPlayer(state, PLAYER_ID, rng)

    // Fire for many ticks to create bullets
    const stepInputs: PlayerInputs = {
      [PLAYER_ID]: { left: false, right: false, thrust: true, fire: true },
    }
    for (let i = 0; i < 30; i++) {
      step(state, stepInputs, 33, rng)
    }

    const snapshot = captureSnapshot(state, PLAYER_ID, {
      id: 'codec-bullets-test',
    })

    // Verify we actually have bullets
    expect(snapshot.bullets.length).toBeGreaterThan(0)

    const encoded = encodeScenarioBankDocument([snapshot])
    const decoded = decodeScenarioBankDocument(encoded)
    const result = decoded[0]!

    expect(result.bullets.length).toBe(snapshot.bullets.length)
    for (let i = 0; i < snapshot.bullets.length; i++) {
      const expected = snapshot.bullets[i]!
      const actual = result.bullets[i]!
      expect(actual.x).toBeCloseTo(expected.x, 3)
      expect(actual.y).toBeCloseTo(expected.y, 3)
      expect(actual.z).toBeCloseTo(expected.z, 3)
      expect(actual.firedAt).toBe(expected.firedAt)
      expect(actual.ownerIndex).toBe(expected.ownerIndex)
      // Velocity round-trip
      expect(actual.angularVelocityX).toBeCloseTo(expected.angularVelocityX, 3)
      expect(actual.angularVelocityY).toBeCloseTo(expected.angularVelocityY, 3)
      expect(actual.angularVelocityZ).toBeCloseTo(expected.angularVelocityZ, 3)
    }
  })

  it('decodes compact-v3 format with bullets: []', () => {
    // Simulate a v3 document
    const snapshot = createTestSnapshot('codec-v3-compat')

    // Manually build a v3 document
    const v3Doc = {
      version: 3,
      format: 'compact-v3',
      precision: 6,
      scenarios: [
        [
          snapshot.id,
          snapshot.difficulty,
          snapshot.gameTime,
          snapshot.wave,
          [
            snapshot.ship.x,
            snapshot.ship.y,
            snapshot.ship.z,
            snapshot.ship.yaw,
            snapshot.ship.angularVelocityX,
            snapshot.ship.angularVelocityY,
            snapshot.ship.angularVelocityZ,
            snapshot.ship.alive ? 1 : 0,
            snapshot.ship.firedAt,
          ],
          [
            snapshot.player.score,
            snapshot.player.lives,
            snapshot.player.alive ? 1 : 0,
            snapshot.player.startedAt,
            snapshot.player.diedAt,
            snapshot.player.regeneratedAt,
            snapshot.player.waveSpawnedAt,
            snapshot.player.nextWaveCheckAt,
            snapshot.player.lastRockEncounterAt,
            snapshot.player.leftPressedAt,
            snapshot.player.rightPressedAt,
            snapshot.player.thrustPressedAt,
          ],
          snapshot.rocks.map((r) => [
            r.x,
            r.y,
            r.z,
            r.angularVelocityX,
            r.angularVelocityY,
            r.angularVelocityZ,
            r.size,
          ]),
        ],
      ],
    }

    const decoded = decodeScenarioBankDocument(v3Doc)
    expect(decoded).toHaveLength(1)

    const result = decoded[0]!
    expect(result.id).toBe(snapshot.id)
    expect(result.bullets).toEqual([])
    expect(result.rocks.length).toBe(snapshot.rocks.length)
    // v3 preserves angular velocity directly (no heading+speed conversion)
    expect(result.ship.angularVelocityX).toBe(snapshot.ship.angularVelocityX)
    expect(result.ship.angularVelocityY).toBe(snapshot.ship.angularVelocityY)
    expect(result.ship.angularVelocityZ).toBe(snapshot.ship.angularVelocityZ)
  })

  it('preserves failureSignature and captureType', () => {
    const snapshot = createTestSnapshot('codec-metadata')
    snapshot.failureSignature = '0010110100'
    snapshot.captureType = 'kill'

    const encoded = encodeScenarioBankDocument([snapshot])
    const decoded = decodeScenarioBankDocument(encoded)
    const result = decoded[0]!

    expect(result.failureSignature).toBe('0010110100')
    expect(result.captureType).toBe('kill')
  })
})

describe('angularVelocityToHeadingSpeed / headingSpeedToAngularVelocity', () => {
  it('round-trips an angular velocity perpendicular to position', () => {
    // Position on unit sphere
    const x = 0.5
    const y = 0.7071
    const z = 0.5

    // Build an angular velocity perpendicular to position:
    // Start with arbitrary vector, subtract the radial component
    let avX = 0.1
    let avY = -0.05
    let avZ = 0.08
    const dot = avX * x + avY * y + avZ * z
    avX -= dot * x
    avY -= dot * y
    avZ -= dot * z

    const [heading, speed] = angularVelocityToHeadingSpeed(
      x,
      y,
      z,
      avX,
      avY,
      avZ
    )
    const [rX, rY, rZ] = headingSpeedToAngularVelocity(x, y, z, heading, speed)

    expect(rX).toBeCloseTo(avX, 4)
    expect(rY).toBeCloseTo(avY, 4)
    expect(rZ).toBeCloseTo(avZ, 4)
  })

  it('handles zero velocity', () => {
    const [heading, speed] = angularVelocityToHeadingSpeed(0, 1, 0, 0, 0, 0)
    expect(heading).toBe(0)
    expect(speed).toBe(0)

    const [rX, rY, rZ] = headingSpeedToAngularVelocity(0, 1, 0, 0, 0)
    expect(rX).toBe(0)
    expect(rY).toBe(0)
    expect(rZ).toBe(0)
  })

  it('preserves speed magnitude', () => {
    const avX = 0.2
    const avY = -0.1
    const avZ = 0.15

    const [, speed] = angularVelocityToHeadingSpeed(
      0.5,
      0.7,
      0.5,
      avX,
      avY,
      avZ
    )
    const expectedSpeed = Math.sqrt(avX * avX + avY * avY + avZ * avZ)
    expect(speed).toBeCloseTo(expectedSpeed, 5)
  })
})
