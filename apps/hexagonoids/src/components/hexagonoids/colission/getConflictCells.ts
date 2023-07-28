import { storeToCells } from './storeToCells'
import type { ProjectileStore, TargetStore } from './typeCheck'

// FIXME: no longer used
export const getConflictCells = (
  targets: Set<TargetStore>,
  projectiles: Set<ProjectileStore>,
  resolution: number
) => {
  const lookupCells = new Map<string, Set<TargetStore>>()

  const conflictCells = new Set<string>()
  const conflictTargets = new Set<TargetStore>()
  const conflictProjectiles = new Set<ProjectileStore>()
  const conflictPartners = new Set<
    [target: TargetStore, projectile: ProjectileStore]
  >()

  // locate all targets
  for (const $target of targets) {
    const cells = storeToCells($target, resolution)

    for (const h of cells) {
      if (!lookupCells.has(h)) {
        lookupCells.set(h, new Set<TargetStore>())
      }

      const objectSet = lookupCells.get(h) as Set<TargetStore>
      objectSet.add($target)
    }
  }

  for (const $projectile of projectiles) {
    const cells = storeToCells($projectile, resolution)

    const projectileTargets = new Set<TargetStore>()

    for (const h of cells) {
      if (lookupCells.has(h)) {
        // projectile is in the same cell as a rock (or ship)
        conflictProjectiles.add($projectile)

        if (!conflictCells.has(h)) {
          // we have not already added this cell to the conflict set
          conflictCells.add(h)

          const targets = lookupCells.get(h) ?? []
          for (const $target of targets) {
            // all targets in this cell are in conflict
            conflictTargets.add($target)

            if (!projectileTargets.has($target)) {
              conflictPartners.add([$target, $projectile])
              projectileTargets.add($target)
            }
          }
        }
      }
    }
  }

  return {
    conflictCells,
    conflictPartners,
    conflictTargets,
    conflictProjectiles,
  }
}
