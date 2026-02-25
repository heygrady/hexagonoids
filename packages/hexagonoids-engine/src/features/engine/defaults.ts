import {
  PLAYER_STARTING_LIVES,
  ROCK_LARGE_SIZE,
  ROCK_LARGE_VALUE,
} from './constants.js'
import type {
  BulletState,
  GameState,
  PlayerState,
  RockState,
  ShipState,
} from './types.js'

/**
 * Default ship state. `orientation` and `angularVelocity` are omitted — callers
 * must supply fresh instances to avoid shared mutable references.
 * `lat: 90, lng: 0` matches the north-pole position of `Quaternion.Identity()`.
 */
export const defaultShipState: Omit<
  ShipState,
  'id' | 'playerId' | 'orientation' | 'angularVelocity'
> = {
  lat: 90,
  lng: 0,
  yaw: 0,
  alive: true,
  firedAt: null,
}

/**
 * Default rock state. `orientation` and `angularVelocity` are omitted — callers
 * must supply fresh instances to avoid shared mutable references.
 * `lat: 90, lng: 0` matches the north-pole position of `Quaternion.Identity()`.
 */
export const defaultRockState: Omit<
  RockState,
  'id' | 'orientation' | 'angularVelocity'
> = {
  lat: 90,
  lng: 0,
  size: ROCK_LARGE_SIZE,
  value: ROCK_LARGE_VALUE,
}

/**
 * Default bullet state. `orientation` and `angularVelocity` are omitted — callers
 * must supply fresh instances to avoid shared mutable references.
 * `lat: 90, lng: 0` matches the north-pole position of `Quaternion.Identity()`.
 */
export const defaultBulletState: Omit<
  BulletState,
  'id' | 'ownerId' | 'orientation' | 'angularVelocity'
> = {
  lat: 90,
  lng: 0,
  firedAt: null,
}

export const defaultPlayerState: Omit<PlayerState, 'id'> = {
  alive: true,
  score: 0,
  lives: PLAYER_STARTING_LIVES,
  shipId: null,
  startedAt: null,
  diedAt: null,
  regeneratedAt: null,
  waveSpawnedAt: null,
  leftPressedAt: null,
  rightPressedAt: null,
  thrustPressedAt: null,
}

export const defaultGameState: GameState = {
  ships: new Map(),
  rocks: new Map(),
  bullets: new Map(),
  players: new Map(),
  now: 0,
  wave: 0,
  mode: 'single',
  startedAt: null,
  endedAt: null,
}
