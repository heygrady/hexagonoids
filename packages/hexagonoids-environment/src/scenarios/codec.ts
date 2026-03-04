import type { ScenarioSnapshot } from './types.js'

const SCENARIO_FORMAT = 'compact-v3'
const SCENARIO_PRECISION = 6

type CompactShipRecord = [
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

type CompactRockRecord = [
  x: number,
  y: number,
  z: number,
  angularVelocityX: number,
  angularVelocityY: number,
  angularVelocityZ: number,
  size: 0 | 1 | 2,
]

type CompactScenarioRecord = [
  id: string,
  difficulty: number,
  gameTime: number,
  wave: number,
  ship: CompactShipRecord,
  player: CompactPlayerRecord,
  rocks: CompactRockRecord[],
  failureSignature?: string,
  captureType?: string,
]

export interface CompactScenarioBankDocument {
  version: 3
  format: typeof SCENARIO_FORMAT
  precision: number
  scenarios: CompactScenarioRecord[]
}

function roundNumber(value: number, precision = SCENARIO_PRECISION): number {
  return Number(value.toFixed(precision))
}

function deriveRockValue(size: 0 | 1 | 2): number {
  switch (size) {
    case 0:
      return 50
    case 1:
      return 100
    case 2:
      return 200
  }
}

function encodeCompactScenario(
  snapshot: ScenarioSnapshot
): CompactScenarioRecord {
  const record: CompactScenarioRecord = [
    snapshot.id,
    roundNumber(snapshot.difficulty),
    roundNumber(snapshot.gameTime),
    snapshot.wave,
    [
      roundNumber(snapshot.ship.x),
      roundNumber(snapshot.ship.y),
      roundNumber(snapshot.ship.z),
      roundNumber(snapshot.ship.yaw),
      roundNumber(snapshot.ship.angularVelocityX),
      roundNumber(snapshot.ship.angularVelocityY),
      roundNumber(snapshot.ship.angularVelocityZ),
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
    snapshot.rocks.map((rock) => [
      roundNumber(rock.x),
      roundNumber(rock.y),
      roundNumber(rock.z),
      roundNumber(rock.angularVelocityX),
      roundNumber(rock.angularVelocityY),
      roundNumber(rock.angularVelocityZ),
      rock.size,
    ]),
  ]
  if (snapshot.failureSignature != null || snapshot.captureType === 'kill') {
    record.push(snapshot.failureSignature ?? '')
  }
  if (snapshot.captureType === 'kill') {
    record.push('k')
  }
  return record
}

function decodeCompactScenario(
  record: CompactScenarioRecord
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

function isCompactScenarioBankDocument(
  value: unknown
): value is CompactScenarioBankDocument {
  if (value == null || typeof value !== 'object') return false

  const doc = value as Record<string, unknown>
  if (!Array.isArray(doc.scenarios)) return false

  // Accept v2 and v3 compact formats (same tuple structure; v3 adds ship.firedAt)
  if (doc.version === 3 && doc.format === SCENARIO_FORMAT) return true
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

export function encodeScenarioBankDocument(
  snapshots: ScenarioSnapshot[]
): CompactScenarioBankDocument {
  return {
    version: 3,
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
    return value.scenarios.map((record) => decodeCompactScenario(record))
  }

  throw new Error('Unsupported scenario bank format')
}
