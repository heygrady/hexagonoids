import {
  headingToAngularVelocity,
  unitPointToQuaternion,
  vec3Zero,
} from '@heygrady/hexagonoids-engine'

import type { ScenarioSnapshot } from './types.js'

const SCENARIO_FORMAT = 'compact-v5'
const SCENARIO_PRECISION = 4

// ── compact-v4 types ─────────────────────────────────────────────────────────
// Velocity encoded as (heading, speed) instead of (avX, avY, avZ).
// Bullets included after rocks.

type CompactShipRecord_v4 = [
  x: number,
  y: number,
  z: number,
  yaw: number,
  heading: number,
  speed: number,
  alive: 0 | 1,
  firedAt: number | null,
]

type CompactRockRecord_v4 = [
  x: number,
  y: number,
  z: number,
  heading: number,
  speed: number,
  size: 0 | 1 | 2,
]

type CompactBulletRecord = [
  x: number,
  y: number,
  z: number,
  heading: number,
  speed: number,
  firedAt: number | null,
  ownerIndex: number,
]

type CompactScenarioRecord_v4 = [
  id: string,
  difficulty: number,
  gameTime: number,
  wave: number,
  ship: CompactShipRecord_v4,
  player: CompactPlayerRecord,
  rocks: CompactRockRecord_v4[],
  bullets: CompactBulletRecord[],
  failureSignature?: string,
  captureType?: string,
  necklace?: number,
  rockCount?: number,
]

type CompactPlayerRecord = [
  score: number,
  lives: number,
  alive: 0 | 1,
  startedAt: number | null,
  diedAt: number | null,
  regeneratedAt: number | null,
  waveSpawnedAt: number | null,
  nextWaveCheckAt: number | null,
  lastRockEncounterAt: number | null,
  leftPressedAt: number | null,
  rightPressedAt: number | null,
  thrustPressedAt: number | null,
]

// ── Legacy compact-v2/v3 types (decode only) ─────────────────────────────────

type CompactShipRecord_v3 = [
  x: number,
  y: number,
  z: number,
  yaw: number,
  angularVelocityX: number,
  angularVelocityY: number,
  angularVelocityZ: number,
  alive: 0 | 1,
  firedAt: number | null,
]

type CompactRockRecord_v3 = [
  x: number,
  y: number,
  z: number,
  angularVelocityX: number,
  angularVelocityY: number,
  angularVelocityZ: number,
  size: 0 | 1 | 2,
]

type CompactScenarioRecord_v3 = [
  id: string,
  difficulty: number,
  gameTime: number,
  wave: number,
  ship: CompactShipRecord_v3,
  player: CompactPlayerRecord,
  rocks: CompactRockRecord_v3[],
  failureSignature?: string,
  captureType?: string,
]

export interface CompactScenarioBankDocument {
  version: 3 | 4 | 5
  format: string
  precision: number
  scenarios: CompactScenarioRecord_v4[] | CompactScenarioRecord_v3[]
}

// ── Utility functions ────────────────────────────────────────────────────────

function roundNumber(value: number, precision = SCENARIO_PRECISION): number {
  return Number(value.toFixed(precision))
}

function deriveRockValue(size: 0 | 1 | 2): number {
  // Engine: small (0) = 200, medium (1) = 100, large (2) = 50
  switch (size) {
    case 0:
      return 200
    case 1:
      return 100
    case 2:
      return 50
  }
}

/**
 * Convert angular velocity (avX, avY, avZ) at position (x, y, z) to (heading, speed).
 *
 * Angular velocity on the unit sphere has 2 DOF (perpendicular to position).
 * We decompose into local heading angle and scalar speed, using the same
 * quaternion frame that `headingToAngularVelocity` uses for reconstruction.
 */
export function angularVelocityToHeadingSpeed(
  x: number,
  y: number,
  z: number,
  avX: number,
  avY: number,
  avZ: number
): [heading: number, speed: number] {
  const speed = Math.sqrt(avX * avX + avY * avY + avZ * avZ)
  if (speed < 1e-10) {
    return [0, 0]
  }

  // Linear velocity on the sphere: v = ω × p
  // For motion on a unit sphere, v = worldHeading * speed (see headingToAngularVelocity)
  const vx = avY * z - avZ * y
  const vy = avZ * x - avX * z
  const vz = avX * y - avY * x

  // Get the same quaternion frame that headingToAngularVelocity uses
  const q = unitPointToQuaternion(x, y, z)
  const qx = q[0]
  const qy = q[1]
  const qz = q[2]
  const qw = q[3]

  // Forward (local Z) in world space — column 2 of rotation matrix from quaternion
  const fwdX = 2 * (qx * qz + qw * qy)
  const fwdY = 2 * (qy * qz - qw * qx)
  const fwdZ = 1 - 2 * (qx * qx + qy * qy)

  // Right (local X) in world space — column 0 of rotation matrix from quaternion
  const rightX = 1 - 2 * (qy * qy + qz * qz)
  const rightY = 2 * (qx * qy + qw * qz)
  const rightZ = 2 * (qx * qz - qw * qy)

  // Project velocity onto quaternion's forward and right axes
  const fwdComponent = vx * fwdX + vy * fwdY + vz * fwdZ
  const rightComponent = vx * rightX + vy * rightY + vz * rightZ

  // heading: 0 = forward, π/2 = right (matches headingToAngularVelocity convention)
  const heading = Math.atan2(rightComponent, fwdComponent)
  return [heading, speed]
}

/**
 * Convert (heading, speed) at position (x, y, z) back to angular velocity.
 * Uses the engine's headingToAngularVelocity with a quaternion from the position.
 */
export function headingSpeedToAngularVelocity(
  x: number,
  y: number,
  z: number,
  heading: number,
  speed: number
): [avX: number, avY: number, avZ: number] {
  if (speed < 1e-10) {
    return [0, 0, 0]
  }
  const q = unitPointToQuaternion(x, y, z)
  const av = vec3Zero()
  headingToAngularVelocity(av, q, heading, speed)
  return [av[0], av[1], av[2]]
}

// ── Encode (v4) ──────────────────────────────────────────────────────────────

function encodeCompactScenario(
  snapshot: ScenarioSnapshot
): CompactScenarioRecord_v4 {
  const [shipHeading, shipSpeed] = angularVelocityToHeadingSpeed(
    snapshot.ship.x,
    snapshot.ship.y,
    snapshot.ship.z,
    snapshot.ship.angularVelocityX,
    snapshot.ship.angularVelocityY,
    snapshot.ship.angularVelocityZ
  )

  const record: CompactScenarioRecord_v4 = [
    snapshot.id,
    roundNumber(snapshot.difficulty),
    roundNumber(snapshot.gameTime),
    snapshot.wave,
    [
      roundNumber(snapshot.ship.x),
      roundNumber(snapshot.ship.y),
      roundNumber(snapshot.ship.z),
      roundNumber(snapshot.ship.yaw),
      roundNumber(shipHeading),
      roundNumber(shipSpeed),
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
    snapshot.rocks.map((rock) => {
      const [heading, speed] = angularVelocityToHeadingSpeed(
        rock.x,
        rock.y,
        rock.z,
        rock.angularVelocityX,
        rock.angularVelocityY,
        rock.angularVelocityZ
      )
      return [
        roundNumber(rock.x),
        roundNumber(rock.y),
        roundNumber(rock.z),
        roundNumber(heading),
        roundNumber(speed),
        rock.size,
      ] as CompactRockRecord_v4
    }),
    snapshot.bullets.map((bullet) => {
      const [heading, speed] = angularVelocityToHeadingSpeed(
        bullet.x,
        bullet.y,
        bullet.z,
        bullet.angularVelocityX,
        bullet.angularVelocityY,
        bullet.angularVelocityZ
      )
      return [
        roundNumber(bullet.x),
        roundNumber(bullet.y),
        roundNumber(bullet.z),
        roundNumber(heading),
        roundNumber(speed),
        bullet.firedAt,
        bullet.ownerIndex,
      ] as CompactBulletRecord
    }),
  ]
  if (snapshot.failureSignature != null || snapshot.captureType === 'kill') {
    record.push(snapshot.failureSignature ?? '')
  }
  if (snapshot.captureType === 'kill') {
    record.push('k')
  }
  if (snapshot.necklace != null || snapshot.rockCount != null) {
    // Ensure failureSignature + captureType slots exist
    if (record.length <= 8) record.push(snapshot.failureSignature ?? '')
    if (record.length <= 9)
      record.push(snapshot.captureType === 'kill' ? 'k' : '')
    record.push(snapshot.necklace ?? -1)
    if (snapshot.rockCount != null) record.push(snapshot.rockCount)
  }
  return record
}

function decodeCompactScenario_v4(
  record: CompactScenarioRecord_v4
): ScenarioSnapshot {
  const [id, difficulty, gameTime, wave, ship, player, rocks, bullets] = record
  const rawFailureSignature =
    record.length > 8 && typeof record[8] === 'string' ? record[8] : undefined
  const failureSignature =
    rawFailureSignature !== '' ? rawFailureSignature : undefined
  const captureType: 'death' | 'kill' =
    record.length > 9 && record[9] === 'k' ? 'kill' : 'death'
  const necklace =
    record.length > 10 && typeof record[10] === 'number'
      ? record[10]
      : undefined
  const rockCount =
    record.length > 11 && typeof record[11] === 'number'
      ? record[11]
      : undefined

  const [shipAvX, shipAvY, shipAvZ] = headingSpeedToAngularVelocity(
    ship[0],
    ship[1],
    ship[2],
    ship[4],
    ship[5]
  )

  const snapshot: ScenarioSnapshot = {
    version: 1,
    id,
    difficulty,
    gameTime,
    wave,
    ship: {
      x: ship[0],
      y: ship[1],
      z: ship[2],
      yaw: ship[3],
      angularVelocityX: shipAvX,
      angularVelocityY: shipAvY,
      angularVelocityZ: shipAvZ,
      alive: ship[6] === 1,
      firedAt: ship[7] ?? null,
    },
    player: {
      score: player[0],
      lives: player[1],
      alive: player[2] === 1,
      startedAt: player[3],
      diedAt: player[4],
      regeneratedAt: player[5],
      waveSpawnedAt: player[6],
      nextWaveCheckAt: player[7],
      lastRockEncounterAt: player[8],
      leftPressedAt: player[9],
      rightPressedAt: player[10],
      thrustPressedAt: player[11],
    },
    rocks: rocks.map((rock) => {
      const [avX, avY, avZ] = headingSpeedToAngularVelocity(
        rock[0],
        rock[1],
        rock[2],
        rock[3],
        rock[4]
      )
      return {
        x: rock[0],
        y: rock[1],
        z: rock[2],
        angularVelocityX: avX,
        angularVelocityY: avY,
        angularVelocityZ: avZ,
        size: rock[5],
        value: deriveRockValue(rock[5]),
      }
    }),
    bullets: bullets.map((bullet) => {
      const [avX, avY, avZ] = headingSpeedToAngularVelocity(
        bullet[0],
        bullet[1],
        bullet[2],
        bullet[3],
        bullet[4]
      )
      return {
        x: bullet[0],
        y: bullet[1],
        z: bullet[2],
        angularVelocityX: avX,
        angularVelocityY: avY,
        angularVelocityZ: avZ,
        firedAt: bullet[5],
        ownerIndex: bullet[6],
      }
    }),
  }
  if (failureSignature != null) {
    snapshot.failureSignature = failureSignature
  }
  if (captureType === 'kill') {
    snapshot.captureType = 'kill'
  }
  if (necklace != null && necklace >= 0) {
    snapshot.necklace = necklace
  }
  if (rockCount != null) {
    snapshot.rockCount = rockCount
  }
  return snapshot
}

// ── Decode legacy v2/v3 ──────────────────────────────────────────────────────

function decodeCompactScenario_v3(
  record: CompactScenarioRecord_v3
): ScenarioSnapshot {
  const [id, difficulty, gameTime, wave, ship, player, rocks] = record
  const rawFailureSignature =
    record.length > 7 && typeof record[7] === 'string' ? record[7] : undefined
  const failureSignature =
    rawFailureSignature !== '' ? rawFailureSignature : undefined
  const captureType: 'death' | 'kill' =
    record.length > 8 && record[8] === 'k' ? 'kill' : 'death'

  const snapshot: ScenarioSnapshot = {
    version: 1,
    id,
    difficulty,
    gameTime,
    wave,
    ship: {
      x: ship[0],
      y: ship[1],
      z: ship[2],
      yaw: ship[3],
      angularVelocityX: ship[4],
      angularVelocityY: ship[5],
      angularVelocityZ: ship[6],
      alive: ship[7] === 1,
      firedAt: ship[8] ?? null,
    },
    player: {
      score: player[0],
      lives: player[1],
      alive: player[2] === 1,
      startedAt: player[3],
      diedAt: player[4],
      regeneratedAt: player[5],
      waveSpawnedAt: player[6],
      nextWaveCheckAt: player[7],
      lastRockEncounterAt: player[8],
      leftPressedAt: player[9],
      rightPressedAt: player[10],
      thrustPressedAt: player[11],
    },
    rocks: rocks.map((rock) => ({
      x: rock[0],
      y: rock[1],
      z: rock[2],
      angularVelocityX: rock[3],
      angularVelocityY: rock[4],
      angularVelocityZ: rock[5],
      size: rock[6],
      value: deriveRockValue(rock[6]),
    })),
    bullets: [],
  }
  if (failureSignature != null) {
    snapshot.failureSignature = failureSignature
  }
  if (captureType === 'kill') {
    snapshot.captureType = 'kill'
  }
  return snapshot
}

// ── Format detection ─────────────────────────────────────────────────────────

function isCompactScenarioBankDocument(
  value: unknown
): value is CompactScenarioBankDocument {
  if (value == null || typeof value !== 'object') return false

  const doc = value as Record<string, unknown>
  if (!Array.isArray(doc.scenarios)) return false

  // Accept v2, v3, v4, and v5 compact formats
  if (doc.version === 5 && doc.format === 'compact-v5') return true
  if (doc.version === 4 && doc.format === 'compact-v4') return true
  if (doc.version === 3 && doc.format === 'compact-v3') return true
  if (doc.version === 2 && doc.format === 'compact-v2') return true

  return false
}

function isScenarioSnapshot(value: unknown): value is ScenarioSnapshot {
  if (value == null || typeof value !== 'object') return false

  const snapshot = value as Partial<ScenarioSnapshot>
  return (
    snapshot.version === 1 &&
    typeof snapshot.id === 'string' &&
    snapshot.ship != null &&
    snapshot.player != null &&
    Array.isArray(snapshot.rocks) &&
    Array.isArray(snapshot.bullets)
  )
}

// ── Public API ───────────────────────────────────────────────────────────────

export function encodeScenarioBankDocument(
  snapshots: ScenarioSnapshot[]
): CompactScenarioBankDocument {
  return {
    version: 5,
    format: SCENARIO_FORMAT,
    precision: SCENARIO_PRECISION,
    scenarios: snapshots.map((snapshot) => encodeCompactScenario(snapshot)),
  }
}

export function decodeScenarioBankDocument(value: unknown): ScenarioSnapshot[] {
  if (Array.isArray(value)) {
    if (value.every((entry) => isScenarioSnapshot(entry))) {
      return value
    }
    throw new Error('Scenario bank array is not a valid ScenarioSnapshot[]')
  }

  if (isCompactScenarioBankDocument(value)) {
    if (value.version === 5 || value.version === 4) {
      return (value.scenarios as CompactScenarioRecord_v4[]).map((record) =>
        decodeCompactScenario_v4(record)
      )
    }
    // v2 and v3 use the same tuple structure (v3 added ship.firedAt)
    return (value.scenarios as CompactScenarioRecord_v3[]).map((record) =>
      decodeCompactScenario_v3(record)
    )
  }

  throw new Error('Unsupported scenario bank format')
}
