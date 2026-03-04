/**
 * Scenario snapshot types — plain JSON-serializable structures
 * capturing game state for scenario-based training.
 */

export interface ScenarioShipState {
  x: number
  y: number
  z: number
  yaw: number
  angularVelocityX: number
  angularVelocityY: number
  angularVelocityZ: number
  alive: boolean
  firedAt: number | null
}

export interface ScenarioPlayerState {
  score: number
  lives: number
  alive: boolean
  startedAt: number | null
  diedAt: number | null
  regeneratedAt: number | null
  waveSpawnedAt: number | null
  nextWaveCheckAt: number | null
  lastRockEncounterAt: number | null
  leftPressedAt: number | null
  rightPressedAt: number | null
  thrustPressedAt: number | null
}

export interface ScenarioRockState {
  x: number
  y: number
  z: number
  angularVelocityX: number
  angularVelocityY: number
  angularVelocityZ: number
  size: 0 | 1 | 2
  value: number
}

export interface ScenarioBulletState {
  x: number
  y: number
  z: number
  angularVelocityX: number
  angularVelocityY: number
  angularVelocityZ: number
  firedAt: number | null
  /** Index into the snapshot's ship (always 0 for single-player). */
  ownerIndex: number
}

export interface ScenarioSnapshot {
  version: 1
  id: string
  difficulty: number
  gameTime: number
  wave: number
  ship: ScenarioShipState
  player: ScenarioPlayerState
  rocks: ScenarioRockState[]
  bullets: ScenarioBulletState[]
  /** Panel failure signature from scenario generation (e.g. "0010110100"). Optional. */
  failureSignature?: string
  /** How this snapshot was captured. Optional — absent means 'death'. */
  captureType?: 'death' | 'kill'
}
