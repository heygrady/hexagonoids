import type { RNG } from '@neat-evolution/utils'

import {
  PLAYER_STARTING_LIVES,
  ROCK_ENCOUNTER_COOLDOWN,
  ROCK_ENCOUNTER_DISTANCE,
  ROCK_WAVE_GRACE_PERIOD,
  ROCK_WAVE_PERIOD,
  SHIP_REGENERATION_WAIT_PERIOD,
} from '../constants.js'
import { defaultPlayerState } from '../defaults.js'
import { elapsed } from '../gameTime.js'
import { spawnWave } from '../rock/rockActions.js'
import { destroyShip, spawnShip } from '../ship/shipActions.js'
import type { GameState } from '../types.js'

import { decrementLives, incrementScore } from './playerSetters.js'

const DEG_TO_RAD = Math.PI / 180

/**
 * Angular distance between two lat/lng points in radians (unit sphere).
 * Uses the Haversine formula.
 */
function angularDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const lat1Rad = lat1 * DEG_TO_RAD
  const lat2Rad = lat2 * DEG_TO_RAD
  const dLat = (lat2 - lat1) * DEG_TO_RAD
  const dLng = (lng2 - lng1) * DEG_TO_RAD

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1Rad) * Math.cos(lat2Rad) * Math.sin(dLng / 2) ** 2
  return 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

/**
 * Check if any rock is within encounter distance of the given position.
 */
export function hasNearbyRocks(
  game: GameState,
  lat: number,
  lng: number
): boolean {
  for (const rock of game.rocks.values()) {
    if (
      angularDistance(lat, lng, rock.lat, rock.lng) < ROCK_ENCOUNTER_DISTANCE
    ) {
      return true
    }
  }
  return false
}

/**
 * Start a new game for a player.
 * Creates the player, sets initial state, and spawns a ship.
 * No-ops if the player already exists.
 */
export function startPlayer(game: GameState, playerId: string, rng: RNG): void {
  if (game.players.has(playerId)) return

  const id = playerId
  // Set waveSpawnedAt so the first wave spawns after ROCK_WAVE_GRACE_PERIOD,
  // not immediately (null would cause instant spawn via elapsed() = Infinity).
  const player = {
    ...defaultPlayerState,
    id,
    alive: true,
    lives: PLAYER_STARTING_LIVES,
    score: 0,
    startedAt: game.now,
    waveSpawnedAt: game.now - ROCK_WAVE_PERIOD + ROCK_WAVE_GRACE_PERIOD,
  }
  game.players.set(id, player)

  // Spawn a ship at a random position
  const lat = (rng.gen() - 0.5) * 180
  const lng = (rng.gen() - 0.5) * 360
  const ship = spawnShip(game, playerId, lat, lng, rng)
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
  spawnLat?: number,
  spawnLng?: number
): void {
  const player = game.players.get(playerId)
  if (player == null) return
  if (player.alive) return
  if (player.lives <= 0) return

  player.alive = true
  player.regeneratedAt = game.now
  decrementLives(player)

  // Spawn at provided position, or fall back to random
  const lat = spawnLat ?? (rng.gen() - 0.5) * 180
  const lng = spawnLng ?? (rng.gen() - 0.5) * 360
  const ship = spawnShip(game, playerId, lat, lng, rng)
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
  rng: RNG
): void {
  const player = game.players.get(playerId)
  if (player == null || !player.alive) return

  if (elapsed(game, player.waveSpawnedAt) > ROCK_WAVE_PERIOD) {
    const ship =
      player.shipId != null ? game.ships.get(player.shipId) : undefined
    if (ship == null) return

    // Don't spawn if rocks are nearby — delay by encounter cooldown
    if (hasNearbyRocks(game, ship.lat, ship.lng)) {
      // Push waveSpawnedAt forward so we re-check after cooldown, not every tick
      player.waveSpawnedAt =
        game.now - ROCK_WAVE_PERIOD + ROCK_ENCOUNTER_COOLDOWN
      return
    }

    spawnWave(game, ship.lat, ship.lng, rng)
    player.waveSpawnedAt = game.now
  }
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
