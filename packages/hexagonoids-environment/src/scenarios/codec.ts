import type { ScenarioSnapshot } from './types.js'

const SCENARIO_FORMAT = 'compact-v2'
const SCENARIO_PRECISION = 6

type CompactShipRecord = [
  lat: number,
  lng: number,
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
  lat: number,
  lng: number,
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
  version: 2
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
      roundNumber(snapshot.ship.lat),
      roundNumber(snapshot.ship.lng),
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
      roundNumber(rock.lat),
      roundNumber(rock.lng),
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
      lat: ship[0],
      lng: ship[1],
      yaw: ship[2],
      angularVelocityX: ship[3],
      angularVelocityY: ship[4],
      angularVelocityZ: ship[5],
      alive: ship[6] === 1,
      firedAt: ship[7],
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
      lat: rock[0],
      lng: rock[1],
      angularVelocityX: rock[2],
      angularVelocityY: rock[3],
      angularVelocityZ: rock[4],
      size: rock[5],
      value: deriveRockValue(rock[5]),
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

  const doc = value as Partial<CompactScenarioBankDocument>
  return (
    doc.version === 2 &&
    doc.format === SCENARIO_FORMAT &&
    Array.isArray(doc.scenarios)
  )
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
    version: 2,
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
