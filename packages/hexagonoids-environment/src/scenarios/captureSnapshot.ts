import type { GameState } from '@heygrady/hexagonoids-engine'

import type {
  ScenarioBulletState,
  ScenarioRockState,
  ScenarioSnapshot,
} from './types.js'

let snapshotCounter = 0

/**
 * Capture the current game state into a plain JSON-serializable snapshot.
 *
 * The snapshot records the ship, player, rocks, and bullets at a point in time
 * so the state can be restored later for scenario-based evaluation.
 */
export function captureSnapshot(
  state: GameState,
  playerId: string,
  options?: { id?: string; difficulty?: number }
): ScenarioSnapshot {
  const player = state.players.get(playerId)
  if (player == null) {
    throw new Error(`Player "${playerId}" not found in game state`)
  }

  const ship =
    player.shipId != null ? state.ships.get(player.shipId) : undefined
  if (ship == null) {
    throw new Error(`Ship not found for player "${playerId}"`)
  }

  const id = options?.id ?? `scenario-${state.now}-${snapshotCounter++}`

  const rocks: ScenarioRockState[] = []
  for (const rock of state.rocks.values()) {
    rocks.push({
      lat: rock.lat,
      lng: rock.lng,
      angularVelocityX: rock.angularVelocity.x,
      angularVelocityY: rock.angularVelocity.y,
      angularVelocityZ: rock.angularVelocity.z,
      size: rock.size,
      value: rock.value,
    })
  }

  const bullets: ScenarioBulletState[] = []
  for (const bullet of state.bullets.values()) {
    bullets.push({
      lat: bullet.lat,
      lng: bullet.lng,
      angularVelocityX: bullet.angularVelocity.x,
      angularVelocityY: bullet.angularVelocity.y,
      angularVelocityZ: bullet.angularVelocity.z,
      firedAt: bullet.firedAt,
      ownerIndex: 0, // single-player: always index 0
    })
  }

  return {
    version: 1,
    id,
    difficulty: options?.difficulty ?? 0,
    gameTime: state.now,
    wave: state.wave,
    ship: {
      lat: ship.lat,
      lng: ship.lng,
      yaw: ship.yaw,
      angularVelocityX: ship.angularVelocity.x,
      angularVelocityY: ship.angularVelocity.y,
      angularVelocityZ: ship.angularVelocity.z,
      alive: ship.alive,
      firedAt: ship.firedAt,
    },
    player: {
      score: player.score,
      lives: player.lives,
      alive: player.alive,
      startedAt: player.startedAt,
      diedAt: player.diedAt,
      regeneratedAt: player.regeneratedAt,
      waveSpawnedAt: player.waveSpawnedAt,
      nextWaveCheckAt: player.nextWaveCheckAt,
      lastRockEncounterAt: player.lastRockEncounterAt,
      leftPressedAt: player.leftPressedAt,
      rightPressedAt: player.rightPressedAt,
      thrustPressedAt: player.thrustPressedAt,
    },
    rocks,
    bullets,
  }
}
