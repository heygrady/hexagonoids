import type { RNG } from '@neat-evolution/utils'
import type { SpatialPoint } from '../../spatial-index/index.js'
import {
  MAX_ROCKS,
  PLAYER_STARTING_LIVES,
  RADIUS,
  ROCK_ENCOUNTER_DISTANCE,
  ROCK_FAR_CLEAR_DISTANCE,
  ROCK_NO_ENCOUNTER_REPLENISH_DELAY,
  ROCK_WAVE_RETRY_DEFER_PERIOD,
  ROCK_WAVE_SIZES,
  ROCK_WORLD_CAP_WAVE_MULTIPLIER,
  SCORE_BAND_HIGH_MIN,
  SCORE_BAND_MID_MIN,
  SCORE_CLEAR_THRESHOLD_HIGH,
  SCORE_CLEAR_THRESHOLD_MID,
  SCORE_WAVE_DELAY_HIGH_FLOOR,
  SCORE_WAVE_DELAY_HIGH_START,
  SCORE_WAVE_DELAY_LOW,
  SCORE_WAVE_DELAY_MID_END,
  SCORE_WAVE_DELAY_MID_START,
  SCORE_WAVE_WORLD_CAP_BASE,
  SCORE_WAVE_WORLD_CAP_MAX,
  SCORE_WAVE_WORLD_CAP_STEP,
  SHIP_REGENERATION_WAIT_PERIOD,
} from '../constants.js'
import type { ManagedSpatialQueries } from '../createManagedSpatialQueries.js'
import { defaultPlayerState } from '../defaults.js'
import { elapsed } from '../gameTime.js'
import { getSpawnBorderExtents, spawnWave } from '../rock/rockActions.js'
import { destroyShip, spawnShip } from '../ship/shipActions.js'
import type { GameState } from '../types.js'

import { decrementLives, incrementScore } from './playerSetters.js'

function pointFromPosition(position: {
  x: number
  y: number
  z: number
}): SpatialPoint {
  return {
    x: position.x,
    y: position.y,
    z: position.z,
  }
}

function randomUnitPoint(rng: RNG): SpatialPoint {
  const y = rng.gen() * 2 - 1
  const theta = rng.gen() * Math.PI * 2
  const radial = Math.sqrt(Math.max(0, 1 - y * y))
  return {
    x: radial * Math.cos(theta),
    y,
    z: radial * Math.sin(theta),
  }
}

function rocksWithinDistance(
  center: SpatialPoint,
  distanceRad: number,
  spatialQueries: Pick<ManagedSpatialQueries, 'countRocksNear'>
): number {
  return spatialQueries.countRocksNear(center, distanceRad * RADIUS)
}

export function nextWaveDelayMs(score: number): number {
  if (score < SCORE_BAND_MID_MIN) return SCORE_WAVE_DELAY_LOW
  if (score < SCORE_BAND_HIGH_MIN) {
    const ratio =
      (score - SCORE_BAND_MID_MIN) / (SCORE_BAND_HIGH_MIN - SCORE_BAND_MID_MIN)
    return Math.round(
      SCORE_WAVE_DELAY_MID_START +
        (SCORE_WAVE_DELAY_MID_END - SCORE_WAVE_DELAY_MID_START) * ratio
    )
  }
  const highScale = Math.max(
    0,
    Math.floor((score - SCORE_BAND_HIGH_MIN) / 10000)
  )
  return Math.max(
    SCORE_WAVE_DELAY_HIGH_FLOOR,
    SCORE_WAVE_DELAY_HIGH_START - highScale * 80
  )
}

export function worldRockCapForScore(score: number, wave: number): number {
  const scoreCap = Math.min(
    SCORE_WAVE_WORLD_CAP_MAX,
    SCORE_WAVE_WORLD_CAP_BASE + Math.floor(score / SCORE_WAVE_WORLD_CAP_STEP)
  )
  const waveIndex = Math.min(Math.max(0, wave), ROCK_WAVE_SIZES.length - 1)
  const waveSize = ROCK_WAVE_SIZES[waveIndex] ?? ROCK_WAVE_SIZES[0] ?? 4
  const waveCap = waveSize * ROCK_WORLD_CAP_WAVE_MULTIPLIER

  return Math.min(MAX_ROCKS, Math.max(scoreCap, waveCap))
}

function spawnBorderGateDistanceRad(): number {
  const extents = getSpawnBorderExtents()
  const maxDegrees = Math.max(extents.halfHeight, extents.halfWidth)
  return (maxDegrees * Math.PI) / 180
}

function areLeftoverRocksFar(
  center: SpatialPoint,
  spatialQueries: Pick<ManagedSpatialQueries, 'hasRocksNear'>
): boolean {
  return !spatialQueries.hasRocksNear(center, ROCK_FAR_CLEAR_DISTANCE * RADIUS)
}

export type WaveSpawnBlockReason =
  | 'world-cap'
  | 'not-cleared'
  | 'local-clutter'
  | 'none'

export interface WaveSpawnGateResult {
  canSpawn: boolean
  reason: WaveSpawnBlockReason
  deferMs: number
}

function noRecentEncounter(
  game: GameState,
  lastEncounterAt: number | null
): boolean {
  if (lastEncounterAt == null) return true
  return game.now - lastEncounterAt >= ROCK_NO_ENCOUNTER_REPLENISH_DELAY
}

export function evaluateWaveSpawnGate(
  game: GameState,
  center: SpatialPoint,
  score: number,
  lastEncounterAt: number | null = null,
  spatialQueries: Pick<ManagedSpatialQueries, 'countRocksNear' | 'hasRocksNear'>
): WaveSpawnGateResult {
  const worldRocks = game.rocks.size
  const worldCap = worldRockCapForScore(score, game.wave)
  if (worldRocks >= worldCap) {
    return {
      canSpawn: false,
      reason: 'world-cap',
      deferMs: ROCK_WAVE_RETRY_DEFER_PERIOD,
    }
  }

  const spawnGateRocks = rocksWithinDistance(
    center,
    spawnBorderGateDistanceRad(),
    spatialQueries
  )
  const replenishmentAllowed = noRecentEncounter(game, lastEncounterAt)

  if (score < SCORE_BAND_MID_MIN) {
    if (worldRocks !== 0 && !replenishmentAllowed) {
      return {
        canSpawn: false,
        reason: 'not-cleared',
        deferMs: ROCK_WAVE_RETRY_DEFER_PERIOD,
      }
    }
  } else if (score < SCORE_BAND_HIGH_MIN) {
    if (
      worldRocks > SCORE_CLEAR_THRESHOLD_MID ||
      (worldRocks > 0 && !areLeftoverRocksFar(center, spatialQueries))
    ) {
      if (replenishmentAllowed) {
        return { canSpawn: true, reason: 'none', deferMs: 0 }
      }
      return {
        canSpawn: false,
        reason: 'not-cleared',
        deferMs: ROCK_WAVE_RETRY_DEFER_PERIOD,
      }
    }
  } else if (
    worldRocks > SCORE_CLEAR_THRESHOLD_HIGH ||
    spawnGateRocks > 0 ||
    (worldRocks > 0 && !areLeftoverRocksFar(center, spatialQueries))
  ) {
    if (replenishmentAllowed && spawnGateRocks === 0) {
      return { canSpawn: true, reason: 'none', deferMs: 0 }
    }
    return {
      canSpawn: false,
      reason: 'not-cleared',
      deferMs: ROCK_WAVE_RETRY_DEFER_PERIOD,
    }
  }

  if (spawnGateRocks > 0) {
    return {
      canSpawn: false,
      reason: 'local-clutter',
      deferMs: ROCK_WAVE_RETRY_DEFER_PERIOD,
    }
  }

  return { canSpawn: true, reason: 'none', deferMs: 0 }
}

/**
 * Check if any rock is within encounter distance of the given position.
 */
export function hasNearbyRocks(
  center: SpatialPoint,
  spatialQueries: Pick<ManagedSpatialQueries, 'hasRocksNear'>
): boolean {
  return spatialQueries.hasRocksNear(center, ROCK_ENCOUNTER_DISTANCE * RADIUS)
}

/**
 * Start a new game for a player.
 * Creates the player, sets initial state, and spawns a ship.
 * No-ops if the player already exists.
 */
export function startPlayer(game: GameState, playerId: string, rng: RNG): void {
  if (game.players.has(playerId)) return

  const id = playerId
  const player = {
    ...defaultPlayerState,
    id,
    alive: true,
    lives: PLAYER_STARTING_LIVES,
    score: 0,
    startedAt: game.now,
    waveSpawnedAt: null,
    nextWaveCheckAt: game.now,
    lastRockEncounterAt: game.now,
  }
  game.players.set(id, player)

  // Spawn a ship at a random position
  const ship = spawnShip(game, playerId, randomUnitPoint(rng), rng)
  player.shipId = ship.id
}

/**
 * Reset all game state and start a fresh game for a player.
 * Clears all entities, resets wave counter, and creates a new player.
 * Use this for game restarts so the engine owns lifecycle cleanup.
 */
export function restartGame(game: GameState, playerId: string, rng: RNG): void {
  // Clear all entities
  game.ships.clear()
  game.rocks.clear()
  game.bullets.clear()
  game.players.delete(playerId)

  // Reset game-level state
  game.wave = 0
  game.endedAt = null
  game.startedAt = game.now

  // Start a fresh player
  startPlayer(game, playerId, rng)
}

/**
 * Handle player death (set alive=false, diedAt, clear shipId).
 * Lives are decremented by regeneratePlayer, not here — killPlayer only marks
 * the death event. Game-over fires when lives reach 0 before regeneration.
 */
export function killPlayer(game: GameState, playerId: string): void {
  const player = game.players.get(playerId)
  if (player == null) return

  player.alive = false
  player.diedAt = game.now
  player.leftPressedAt = null
  player.rightPressedAt = null
  player.thrustPressedAt = null

  // Destroy the ship
  if (player.shipId != null) {
    destroyShip(game, player.shipId)
    player.shipId = null
  }

  // If no lives left, game over
  if (player.lives <= 0) {
    game.endedAt = game.now
  }
}

/**
 * Regenerate player after death (decrement lives, spawn new ship).
 * Should be called after SHIP_REGENERATION_WAIT_PERIOD has elapsed.
 * No-ops if the player is already alive.
 */
export function regeneratePlayer(
  game: GameState,
  playerId: string,
  rng: RNG,
  spawnPoint?: SpatialPoint
): void {
  const player = game.players.get(playerId)
  if (player == null) return
  if (player.alive) return
  if (player.lives <= 0) return

  player.alive = true
  player.regeneratedAt = game.now
  decrementLives(player)

  // Spawn at provided position, or fall back to random
  const ship = spawnShip(
    game,
    playerId,
    spawnPoint ?? randomUnitPoint(rng),
    rng
  )
  player.shipId = ship.id
}

/**
 * Award score to a player.
 */
export function scorePlayer(
  game: GameState,
  playerId: string,
  points: number
): void {
  const player = game.players.get(playerId)
  if (player == null) return
  incrementScore(player, points)
}

/**
 * Check if wave spawn is due and spawn if needed.
 * Waves are delayed if rocks are nearby the player (encounter cooldown),
 * matching the original game's behavior of only spawning when the area is clear.
 */
export function checkWaveSpawn(
  game: GameState,
  playerId: string,
  rng: RNG,
  spatialQueries: Pick<ManagedSpatialQueries, 'hasRocksNear' | 'countRocksNear'>
): void {
  const player = game.players.get(playerId)
  if (player == null || !player.alive) return
  if (player.nextWaveCheckAt != null && game.now < player.nextWaveCheckAt)
    return

  const ship = player.shipId != null ? game.ships.get(player.shipId) : undefined
  if (ship == null) return
  const shipPoint = pointFromPosition(ship)

  if (
    spatialQueries.hasRocksNear(shipPoint, ROCK_ENCOUNTER_DISTANCE * RADIUS)
  ) {
    player.lastRockEncounterAt = game.now
    player.nextWaveCheckAt = game.now + ROCK_WAVE_RETRY_DEFER_PERIOD
    return
  }

  const gate = evaluateWaveSpawnGate(
    game,
    shipPoint,
    player.score,
    player.lastRockEncounterAt,
    spatialQueries
  )
  if (!gate.canSpawn) {
    player.nextWaveCheckAt = game.now + gate.deferMs
    return
  }

  spawnWave(game, shipPoint, rng)
  player.waveSpawnedAt = game.now
  player.nextWaveCheckAt = game.now + nextWaveDelayMs(player.score)
}

/**
 * Check if player can regenerate (enough time has passed since death).
 */
export function canRegenerate(game: GameState, playerId: string): boolean {
  const player = game.players.get(playerId)
  if (player == null) return false
  if (player.alive) return false
  if (player.lives <= 0) return false
  return elapsed(game, player.diedAt) >= SHIP_REGENERATION_WAIT_PERIOD
}
