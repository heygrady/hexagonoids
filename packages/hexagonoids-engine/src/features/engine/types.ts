import type { Vector3 } from '@babylonjs/core/Maths/math.vector.js'

// ── Union types ──────────────────────────────────────────────────────────────

export type EntityType = 'ship' | 'rock' | 'bullet'

export type CollisionType = 'bullet-rock' | 'ship-rock' | 'ship-ship'

export type GameMode = 'single' | 'arena'

// ── Entity references ────────────────────────────────────────────────────────

export interface EntityRef {
  id: string
  type: EntityType
}

// ── Entity state interfaces ──────────────────────────────────────────────────
//
// TODO(Session 02): Add `orientation: Quaternion` to ShipState, RockState, and
// BulletState. The SESSION_01 spec included orientation for quaternion spherical
// physics. It was deferred — Session 02 will port those physics functions and
// will need to retrofit this field onto all three entity types.

export interface ShipState {
  id: string

  /** Player who owns this ship */
  playerId: string

  /** Latitude in degrees on the surface of the sphere */
  lat: number

  /** Longitude in degrees on the surface of the sphere */
  lng: number

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

  /** Latitude in degrees on the surface of the sphere */
  lat: number

  /** Longitude in degrees on the surface of the sphere */
  lng: number

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

  /** Latitude in degrees on the surface of the sphere */
  lat: number

  /** Longitude in degrees on the surface of the sphere */
  lng: number

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

  /** Timestamp (game time ms) when the game started */
  startedAt: number | null

  /** Timestamp (game time ms) when the game ended */
  endedAt: number | null
}

// ── Engine options ───────────────────────────────────────────────────────────

export interface EngineOptions {
  mode?: GameMode
  seed?: string
}
