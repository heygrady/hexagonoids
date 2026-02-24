import type { RNG } from '@neat-evolution/utils'

import { expireBullets } from './bullet/bulletActions.js'
import { detectCollisions, handleCollisions } from './collision/index.js'
import { MAX_DURATION, RADIUS } from './constants.js'
import { advanceGameTime } from './gameTime.js'
import type { EngineHooks } from './hooks.js'
import { accelerateShip } from './physics/accelerateShip.js'
import { moveBullet } from './physics/moveBullet.js'
import { moveRock } from './physics/moveRock.js'
import { moveShip } from './physics/moveShip.js'
import { turnShip } from './physics/turnShip.js'
import {
  canRegenerate,
  checkWaveSpawn,
  regeneratePlayer,
} from './player/playerActions.js'
import { fireBullet } from './ship/shipActions.js'
import type { GameState, PlayerInputs } from './types.js'

/**
 * Apply player inputs to their ships.
 * Uses MAX_DURATION for easing (full-speed inputs, no hold tracking).
 */
function applyInputs(
  state: GameState,
  inputs: PlayerInputs,
  dtMs: number,
  rng: RNG
): void {
  for (const [playerId, input] of Object.entries(inputs)) {
    const player = state.players.get(playerId)
    if (player == null || !player.alive || player.shipId == null) continue
    const ship = state.ships.get(player.shipId)
    if (ship == null) continue

    if (input.left) turnShip(ship, -1, dtMs, MAX_DURATION)
    if (input.right) turnShip(ship, 1, dtMs, MAX_DURATION)
    accelerateShip(ship, input.thrust, dtMs, MAX_DURATION)
    if (input.fire) fireBullet(state, ship, rng)
  }
}

/**
 * Move all active entities by integrating their angular velocities.
 */
function moveEntities(state: GameState, dtMs: number): void {
  for (const ship of state.ships.values()) {
    moveShip(ship, dtMs)
  }
  for (const rock of state.rocks.values()) {
    moveRock(rock, dtMs)
  }
  for (const bullet of state.bullets.values()) {
    moveBullet(bullet, dtMs)
  }
}

/**
 * Advance the game simulation by one tick.
 *
 * Step order:
 * 1. Advance game time
 * 2. Apply player inputs (turn, thrust, fire)
 * 3. Move all entities
 * 4. Expire bullets past max lifetime
 * 5. Detect collisions
 * 6. Handle collisions (split rocks, kill players, score points)
 * 7. Regenerate dead players (if respawn delay elapsed and lives > 0)
 * 8. Spawn rock waves
 * 9. Game over — endedAt set by killPlayer; onGameOver hook fired by handleCollisions
 */
/**
 * @param dtMs - Time delta in milliseconds
 */
export function step(
  state: GameState,
  inputs: PlayerInputs,
  dtMs: number,
  rng: RNG,
  hooks?: EngineHooks
): void {
  // Don't step if game is over
  if (state.endedAt != null) return

  // 1. Advance game time
  advanceGameTime(state, dtMs)

  // 2. Apply inputs
  applyInputs(state, inputs, dtMs, rng)

  // 3. Move entities
  moveEntities(state, dtMs)

  // 4. Expire bullets
  expireBullets(state)

  // 5–6. Detect and handle collisions
  const collisions = detectCollisions(state, RADIUS)
  handleCollisions(state, collisions, rng, hooks)

  // 7. Regenerate players
  for (const player of state.players.values()) {
    if (!player.alive && canRegenerate(state, player.id)) {
      regeneratePlayer(state, player.id, rng)
      hooks?.onPlayerRegenerated?.(player.id)
    }
  }

  // 8. Spawn waves
  for (const player of state.players.values()) {
    checkWaveSpawn(state, player.id, rng)
  }
}
