import type { Quaternion, Vector3 } from '@babylonjs/core/Maths/math.vector.js'

// ── Union types ──────────────────────────────────────────────────────────────

export type EntityType = 'ship' | 'rock' | 'bullet'

export type CollisionType =
  | 'bullet-rock'
  | 'bullet-ship'
  | 'ship-rock'
  | 'ship-ship'

export type GameMode = 'single' | 'arena'

// ── Entity references ────────────────────────────────────────────────────────

export interface EntityRef {
  id: string
  type: EntityType
}

// ── Entity state interfaces ──────────────────────────────────────────────────

export interface ShipState {
  id: string

  /** Player who owns this ship */
  playerId: string

  /** Quaternion encoding the entity's position/orientation on the sphere */
  orientation: Quaternion

  /** Latitude in degrees on the surface of the sphere */
  lat: number

  /** Longitude in degrees on the surface of the sphere */
  lng: number

  /** Cached unit-sphere position for fast spatial queries. */
  x?: number
  y?: number
  z?: number

  /**
   * Angular velocity of the ship as a 3D vector.
   * Direction: axis of rotation on the sphere.
   * Magnitude: angular speed in radians per second.
   */
  angularVelocity: Vector3

  /** Rotation of the ship relative to the heading in radians */
  yaw: number

  /** Whether the ship is alive (not exploding) */
  alive: boolean

  /** Timestamp (game time ms) when a projectile was last fired */
  firedAt: number | null
}

export interface RockState {
  id: string

  /** Quaternion encoding the entity's position/orientation on the sphere */
  orientation: Quaternion

  /** Latitude in degrees on the surface of the sphere */
  lat: number

  /** Longitude in degrees on the surface of the sphere */
  lng: number

  /** Cached unit-sphere position for fast spatial queries. */
  x?: number
  y?: number
  z?: number

  /**
   * Angular velocity of the rock as a 3D vector.
   * Direction: axis of rotation on the sphere.
   * Magnitude: angular speed in radians per second.
   */
  angularVelocity: Vector3

  /** Size of the rock: 2 = large, 1 = medium, 0 = small */
  size: 0 | 1 | 2

  /** Point value of the rock */
  value: number
}

export interface BulletState {
  id: string

  /** Quaternion encoding the entity's position/orientation on the sphere */
  orientation: Quaternion

  /** Latitude in degrees on the surface of the sphere */
  lat: number

  /** Longitude in degrees on the surface of the sphere */
  lng: number

  /** Cached unit-sphere position for fast spatial queries. */
  x?: number
  y?: number
  z?: number

  /**
   * Angular velocity of the bullet as a 3D vector.
   * Direction: axis of rotation on the sphere.
   * Magnitude: angular speed in radians per second.
   */
  angularVelocity: Vector3

  /** Timestamp (game time ms) when the bullet was fired */
  firedAt: number | null

  /** ID of the ship that fired this bullet */
  ownerId: string
}

// ── Player state ─────────────────────────────────────────────────────────────

export interface PlayerState {
  id: string
  alive: boolean
  score: number
  lives: number

  /** ID of the player's ship */
  shipId: string | null

  /** Timestamp (game time ms) when the player started */
  startedAt: number | null

  /** Timestamp (game time ms) when the player last died */
  diedAt: number | null

  /** Timestamp (game time ms) when the player last regenerated */
  regeneratedAt: number | null

  /** Timestamp (game time ms) when the last wave was spawned for this player */
  waveSpawnedAt: number | null

  /** Timestamp (game time ms) when we should next evaluate wave spawning */
  nextWaveCheckAt: number | null

  /** Timestamp (game time ms) of the most recent nearby-rock encounter */
  lastRockEncounterAt: number | null

  /** Timestamp (game time ms) when the left turn input started being held */
  leftPressedAt: number | null

  /** Timestamp (game time ms) when the right turn input started being held */
  rightPressedAt: number | null

  /** Timestamp (game time ms) when the thrust input started being held */
  thrustPressedAt: number | null
}

// ── Player inputs ────────────────────────────────────────────────────────────

export interface PlayerInputState {
  left: boolean
  right: boolean
  thrust: boolean
  fire: boolean
}

export interface PlayerInputs {
  [playerId: string]: PlayerInputState
}

// ── Game state ───────────────────────────────────────────────────────────────

export interface GameState {
  ships: Map<string, ShipState>
  rocks: Map<string, RockState>
  bullets: Map<string, BulletState>
  players: Map<string, PlayerState>

  /** Game time in milliseconds since start */
  now: number

  /** Current wave number */
  wave: number

  /** Game mode */
  mode: GameMode

  /** Whether ship thrust uses fast scalar math (vs quaternion validation path). */
  useFastThrust: boolean

  /** Timestamp (game time ms) when the game started */
  startedAt: number | null

  /** Timestamp (game time ms) when the game ended */
  endedAt: number | null
}

// ── Engine options ───────────────────────────────────────────────────────────

export interface EngineOptions {
  mode?: GameMode
  seed?: string
  useFastThrust?: boolean
}
