import { SHIP_REGENERATION_GRACE_PERIOD } from '../constants'
import type { CameraContextValue } from '../ShipCamera'
import type { BulletStore } from '../store/bullet/BulletStore'
import type { GameActions } from '../store/game/GameActions'
import type { RockStore } from '../store/rock/RockStore'
import type { ShipStore } from '../store/ship/ShipStore'

import {
  isBulletState,
  isRockState,
  isShipState,
  type ProjectileStore,
  type TargetStore,
} from './typeCheck'

export const handleCollisionPartners = (
  collisionPartners: Set<[target: TargetStore, projectile: ProjectileStore]>,
  actions: GameActions,
  cameraContext?: CameraContextValue
) => {
  const {
    ships: { collideWithTarget: shipCollideWithTarget },
    rocks: { collideWithBullet: rockCollideWithBullet },
    bullets: { explode, collideWithTarget: bulletCollideWithTarget },
  } = actions

  const usedProjectiles = new Set<ProjectileStore>()
  for (const [$target, $projectile] of collisionPartners) {
    const targetState = $target.get()
    const projectileState = $projectile.get()

    if (usedProjectiles.has($projectile)) {
      continue
    }

    if (isRockState(targetState) && isBulletState(projectileState)) {
      // Bullet hits rock
      bulletCollideWithTarget($projectile as BulletStore, $target as RockStore)
      explode($target) // explode first
      rockCollideWithBullet($target as RockStore, $projectile as BulletStore)
    } else if (isShipState(targetState) && isBulletState(projectileState)) {
      // Bullet hits ship
      // Prevent own bullets from hitting the ship
      const { id: projectileShipId } = projectileState.$ship?.get() ?? {}
      if (targetState.id !== projectileShipId) {
        bulletCollideWithTarget(
          $projectile as BulletStore,
          $target as ShipStore
        )
        explode($target) // explode first
        shipCollideWithTarget(
          $target as ShipStore,
          $projectile as BulletStore,
          cameraContext
        )
      }
    } else if (isShipState(projectileState) && isRockState(targetState)) {
      // Ship hits rock
      const { generatedAt } = projectileState
      if (
        generatedAt == null ||
        Date.now() - generatedAt > SHIP_REGENERATION_GRACE_PERIOD
      ) {
        explode($projectile as ShipStore) // explode first
        shipCollideWithTarget(
          $projectile as ShipStore,
          $target as RockStore,
          cameraContext
        )
      }
      // FIXME: do we want rockCollideWithShip?
    } else if (isShipState(targetState) && isShipState(projectileState)) {
      // Ship hits ship
      // Prevent ship from hitting own ship
      if (targetState.id !== projectileState.id) {
        explode($target) // explode first
        shipCollideWithTarget(
          $projectile as ShipStore,
          $target as ShipStore,
          cameraContext
        )
        explode($projectile as ShipStore) // explode first
        shipCollideWithTarget(
          $target as ShipStore,
          $projectile as ShipStore,
          cameraContext
        )
      }
    } else {
      console.warn('Unhandled collision', targetState, projectileState)
    }

    usedProjectiles.add($projectile)
  }
}
