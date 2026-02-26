import type { RNG } from '@neat-evolution/utils'

import { expireBullets } from './bullet/bulletActions.js'
import { detectCollisions, handleCollisions } from './collision/index.js'
import { RADIUS } from './constants.js'
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
 * Tracks per-player input hold timestamps to compute easing durations,
 * matching the app's behavior where turn/thrust ramp up over time.
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

    // Track left input hold
    if (input.left && player.leftPressedAt == null) {
      player.leftPressedAt = state.now
    } else if (!input.left) {
      player.leftPressedAt = null
    }

    // Track right input hold
    if (input.right && player.rightPressedAt == null) {
      player.rightPressedAt = state.now
    } else if (!input.right) {
      player.rightPressedAt = null
    }

    // Track thrust input hold
    if (input.thrust && player.thrustPressedAt == null) {
      player.thrustPressedAt = state.now
    } else if (!input.thrust) {
      player.thrustPressedAt = null
    }

    if (input.left) {
      const leftDuration = state.now - player.leftPressedAt!
      turnShip(ship, -1, dtMs, leftDuration)
    }
    if (input.right) {
      const rightDuration = state.now - player.rightPressedAt!
      turnShip(ship, 1, dtMs, rightDuration)
    }
    const thrustDuration = input.thrust
      ? state.now - player.thrustPressedAt!
      : 0
    accelerateShip(ship, input.thrust, dtMs, thrustDuration)
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
  const gameOver = state.endedAt != null

  // 1. Advance game time
  advanceGameTime(state, dtMs)

  // 2. Apply inputs
  if (!gameOver) {
    applyInputs(state, inputs, dtMs, rng)
  }

  // 3. Move entities
  moveEntities(state, dtMs)

  // 4. Expire bullets
  expireBullets(state)

  // 5–6. Detect and handle collisions
  if (!gameOver) {
    const collisions = detectCollisions(state, RADIUS)
    handleCollisions(state, collisions, rng, hooks)
  }

  // 7. Regenerate players
  if (!gameOver) {
    for (const player of state.players.values()) {
      if (!player.alive && canRegenerate(state, player.id)) {
        const pos = hooks?.getRegenerationPosition?.(player.id)
        regeneratePlayer(state, player.id, rng, pos?.lat, pos?.lng)
        hooks?.onPlayerRegenerated?.(player.id)
      }
    }
  }

  // 8. Spawn waves
  if (!gameOver) {
    for (const player of state.players.values()) {
      checkWaveSpawn(state, player.id, rng)
    }
  }
}
