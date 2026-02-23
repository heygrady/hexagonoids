import { Quaternion, Vector3 } from '@babylonjs/core/Maths/math.vector.js'

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
 * Default ship state. `orientation` and `angularVelocity` are shared instances.
 * When constructing an entity, always supply fresh instances for mutable value-type fields.
 * Never mutate these fields in-place on a spread default — replace them instead.
 */
export const defaultShipState: Omit<ShipState, 'id' | 'playerId'> = {
  orientation: Quaternion.Identity(),
  lat: 0,
  lng: 0,
  angularVelocity: Vector3.Zero(),
  yaw: 0,
  alive: true,
  firedAt: null,
}

/**
 * Default rock state. `orientation` and `angularVelocity` are shared instances.
 * When constructing an entity, always supply fresh instances for mutable value-type fields.
 * Never mutate these fields in-place on a spread default — replace them instead.
 */
export const defaultRockState: Omit<RockState, 'id'> = {
  orientation: Quaternion.Identity(),
  lat: 0,
  lng: 0,
  angularVelocity: Vector3.Zero(),
  size: ROCK_LARGE_SIZE,
  value: ROCK_LARGE_VALUE,
}

/**
 * Default bullet state. `orientation` and `angularVelocity` are shared instances.
 * When constructing an entity, always supply fresh instances for mutable value-type fields.
 * Never mutate these fields in-place on a spread default — replace them instead.
 */
export const defaultBulletState: Omit<BulletState, 'id' | 'ownerId'> = {
  orientation: Quaternion.Identity(),
  lat: 0,
  lng: 0,
  angularVelocity: Vector3.Zero(),
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
