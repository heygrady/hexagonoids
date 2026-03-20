import type { RNG } from '@neat-evolution/utils'

import { expireBullets } from './bullet/bulletActions.js'
import { detectCollisions, handleCollisions } from './collision/index.js'
import { RADIUS } from './constants.js'
import type { ManagedSpatialQueries } from './createManagedSpatialQueries.js'
import { createManagedSpatialQueries } from './createManagedSpatialQueries.js'
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
 */
function applyInputs(
  state: GameState,
  inputs: PlayerInputs,
  dtMs: number,
  rng: RNG
): void {
  const now = state.now
  for (const playerId in inputs) {
    const input = inputs[playerId]
    if (input == null) continue
    const player = state.players.get(playerId)
    if (player == null || !player.alive || player.shipId == null) continue
    const ship = state.ships.get(player.shipId)
    if (ship == null) continue

    // Track left input hold
    if (input.left && player.leftPressedAt == null) {
      player.leftPressedAt = now
    } else if (!input.left) {
      player.leftPressedAt = null
    }

    // Track right input hold
    if (input.right && player.rightPressedAt == null) {
      player.rightPressedAt = now
    } else if (!input.right) {
      player.rightPressedAt = null
    }

    // Track thrust input hold
    if (input.thrust && player.thrustPressedAt == null) {
      player.thrustPressedAt = now
    } else if (!input.thrust) {
      player.thrustPressedAt = null
    }

    if (input.left) {
      const leftDuration = now - player.leftPressedAt!
      turnShip(ship, -1, dtMs, leftDuration)
    }
    if (input.right) {
      const rightDuration = now - player.rightPressedAt!
      turnShip(ship, 1, dtMs, rightDuration)
    }
    const thrustDuration = input.thrust ? now - player.thrustPressedAt! : 0
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
 */
export function step(
  state: GameState,
  inputs: PlayerInputs,
  dtMs: number,
  rng: RNG,
  hooks?: EngineHooks,
  spatialQueries?: ManagedSpatialQueries
): void {
  const gameOver = state.endedAt != null
  const queries = spatialQueries ?? createManagedSpatialQueries(() => state)

  advanceGameTime(state, dtMs)

  if (!gameOver) {
    applyInputs(state, inputs, dtMs, rng)
  }

  moveEntities(state, dtMs)

  expireBullets(state)

  if (!gameOver) {
    const collisions = detectCollisions(state, RADIUS, queries)
    handleCollisions(state, collisions, rng, hooks)
  }

  if (!gameOver) {
    for (const player of state.players.values()) {
      if (!player.alive && canRegenerate(state, player.id)) {
        const pos = hooks?.getRegenerationPosition?.(player.id)
        regeneratePlayer(state, player.id, rng, pos)
        hooks?.onPlayerRegenerated?.(player.id)
      }
    }
  }

  if (!gameOver) {
    for (const player of state.players.values()) {
      checkWaveSpawn(state, player.id, rng, queries)
    }
  }
}
