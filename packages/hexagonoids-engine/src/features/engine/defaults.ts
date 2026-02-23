import { Vector3 } from '@babylonjs/core/Maths/math.vector.js'

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
 * Default ship state. `angularVelocity` is a shared Vector3 instance.
 * When constructing an entity, always supply a fresh `angularVelocity: new Vector3(0,0,0)`.
 * Never mutate `angularVelocity` in-place on a spread default — replace the field instead.
 */
export const defaultShipState: Omit<ShipState, 'id' | 'playerId'> = {
  lat: 0,
  lng: 0,
  angularVelocity: Vector3.Zero(),
  yaw: 0,
  alive: true,
  firedAt: null,
}

/**
 * Default rock state. `angularVelocity` is a shared Vector3 instance.
 * When constructing an entity, always supply a fresh `angularVelocity: new Vector3(0,0,0)`.
 * Never mutate `angularVelocity` in-place on a spread default — replace the field instead.
 */
export const defaultRockState: Omit<RockState, 'id'> = {
  lat: 0,
  lng: 0,
  angularVelocity: Vector3.Zero(),
  size: ROCK_LARGE_SIZE,
  value: ROCK_LARGE_VALUE,
}

/**
 * Default bullet state. `angularVelocity` is a shared Vector3 instance.
 * When constructing an entity, always supply a fresh `angularVelocity: new Vector3(0,0,0)`.
 * Never mutate `angularVelocity` in-place on a spread default — replace the field instead.
 */
export const defaultBulletState: Omit<BulletState, 'id' | 'ownerId'> = {
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
