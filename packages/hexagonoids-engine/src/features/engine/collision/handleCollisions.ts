import type { RNG } from '@neat-evolution/utils'

import { destroyBullet } from '../bullet/bulletActions.js'
import type { EngineHooks } from '../hooks.js'
import { killPlayer, scorePlayer } from '../player/playerActions.js'
import { splitRock } from '../rock/rockActions.js'
import type { GameState } from '../types.js'

import type { CollisionPair } from './detectCollisions.js'

/**
 * Dispatch collision pairs to the appropriate handlers.
 * Mutates game state in response to collisions.
 */
export function handleCollisions(
  state: GameState,
  collisions: CollisionPair[],
  rng: RNG,
  hooks?: EngineHooks
): void {
  // Track already-processed entities to avoid double processing
  const processedBullets = new Set<string>()
  const processedRocks = new Set<string>()
  const processedShips = new Set<string>()

  for (const pair of collisions) {
    if (pair.type === 'bullet-rock') {
      const bulletId = pair.a.id
      const rockId = pair.b.id

      // Skip already-processed entities
      if (processedBullets.has(bulletId) || processedRocks.has(rockId)) continue
      processedBullets.add(bulletId)
      processedRocks.add(rockId)

      const bullet = state.bullets.get(bulletId)
      const rock = state.rocks.get(rockId)
      if (bullet == null || rock == null) continue

      // Find the player who owns the bullet via the ship
      const ship = state.ships.get(bullet.ownerId)
      const playerId = ship?.playerId

      // Score the player
      if (playerId != null) {
        const player = state.players.get(playerId)
        const scoreBefore = player?.score ?? 0
        scorePlayer(state, playerId, rock.value)
        const scoreAfter = player?.score ?? 0
        if (hooks?.onScoreChanged != null && scoreAfter !== scoreBefore) {
          hooks.onScoreChanged(playerId, scoreAfter, rock.value)
        }
      }

      // Fire collision hook
      hooks?.onCollision?.(pair.a, pair.b, pair.type)

      // Destroy bullet and split rock
      destroyBullet(state, bulletId)
      splitRock(state, rock, rng)
    } else if (pair.type === 'ship-rock') {
      const shipId = pair.a.id
      const rockId = pair.b.id

      // Skip already-processed entities
      if (processedShips.has(shipId) || processedRocks.has(rockId)) continue

      // Narrow-phase verification for ship-rock collisions
      if (
        hooks?.verifyCollision != null &&
        !hooks.verifyCollision(pair.a, pair.b, pair.type)
      ) {
        continue
      }

      processedShips.add(shipId)

      const ship = state.ships.get(shipId)
      if (ship == null) continue

      const playerId = ship.playerId

      // Fire collision hook
      hooks?.onCollision?.(pair.a, pair.b, pair.type)

      // Kill the player (which also destroys the ship)
      killPlayer(state, playerId)
      hooks?.onPlayerDied?.(playerId)

      // Check for game over (endedAt set by killPlayer when lives reach 0)
      if (state.endedAt != null) {
        hooks?.onGameOver?.(playerId)
      }
    }
  }
}
