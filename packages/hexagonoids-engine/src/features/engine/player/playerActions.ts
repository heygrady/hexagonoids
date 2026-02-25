import type { RNG } from '@neat-evolution/utils'

import {
  PLAYER_STARTING_LIVES,
  ROCK_WAVE_PERIOD,
  SHIP_REGENERATION_WAIT_PERIOD,
} from '../constants.js'
import { defaultPlayerState } from '../defaults.js'
import { elapsed } from '../gameTime.js'
import { spawnWave } from '../rock/rockActions.js'
import { destroyShip, spawnShip } from '../ship/shipActions.js'
import type { GameState } from '../types.js'

import { decrementLives, incrementScore } from './playerSetters.js'

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
  }
  game.players.set(id, player)

  // Spawn a ship at a random position
  const lat = (rng.gen() - 0.5) * 180
  const lng = (rng.gen() - 0.5) * 360
  const ship = spawnShip(game, playerId, lat, lng, rng)
  player.shipId = ship.id
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
  rng: RNG
): void {
  const player = game.players.get(playerId)
  if (player == null) return
  if (player.alive) return
  if (player.lives <= 0) return

  player.alive = true
  player.regeneratedAt = game.now
  decrementLives(player)

  // Spawn a new ship near the death location or random
  const lat = (rng.gen() - 0.5) * 180
  const lng = (rng.gen() - 0.5) * 360
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
