import { Vector3 } from '@babylonjs/core/Maths/math.vector'
import { latLngToVector3 } from '@heygrady/h3-babylon'
import type { CoordPair } from 'h3-js'
import * as martinez from 'martinez-polygon-clipping'

import { RADIUS } from '../constants'

import { meshPolygonCache, meshToPolygon } from './meshToPolygon'
import { storeToRadius } from './storeToCells'
import {
  isRockStore,
  isShipStore,
  type ProjectileStore,
  type TargetStore,
} from './typeCheck'

export const sphereCollision = (
  point1: Vector3,
  radius1: number,
  point2: Vector3,
  radius2: number
) => {
  // Calculate the distance between the centers of the spheres.
  const distanceSq = Vector3.DistanceSquared(point1, point2)

  // Calculate the squared sum of the radii of the bounding spheres.
  const radiiSumSq = (radius1 + radius2) * (radius1 + radius2)

  // If the squared distance is less than or equal to the squared sum of the radii,
  // the spheres are colliding, and we add them to the collidingPairs array.
  if (distanceSq <= radiiSumSq) {
    return true
  }
  return false
}

export type CollisionPair = [target: TargetStore, projectile: ProjectileStore]

const detectSphereCollisions = (
  targets: Set<TargetStore>,
  projectiles: Set<ProjectileStore>
): Set<CollisionPair> => {
  const collidingPairs = new Set<CollisionPair>()
  const usedProjectiles = new Set<ProjectileStore>()

  // Pre-compute target positions and radii before nested loop
  const targetDataMap = new Map<
    TargetStore,
    { position: Vector3; radius: number }
  >()
  for (const $target of targets) {
    const { lat, lng } = $target.get()
    const position = latLngToVector3(lat, lng, RADIUS)
    const radius = storeToRadius($target)
    targetDataMap.set($target, { position, radius })
  }

  // Pre-compute projectile positions and radii before nested loop
  const projectileDataMap = new Map<
    ProjectileStore,
    { position: Vector3; radius: number }
  >()
  for (const $projectile of projectiles) {
    const { lat, lng } = $projectile.get()
    const position = latLngToVector3(lat, lng, RADIUS)
    const radius = storeToRadius($projectile)
    projectileDataMap.set($projectile, { position, radius })
  }

  // Perform collision detection with pre-computed data
  for (const $target of targets) {
    const targetData = targetDataMap.get($target)
    if (targetData == null) continue

    for (const $projectile of projectiles) {
      // skip used projectiles
      if (usedProjectiles.has($projectile)) {
        continue
      }

      const projectileData = projectileDataMap.get($projectile)
      if (projectileData == null) continue

      if (
        sphereCollision(
          targetData.position,
          targetData.radius,
          projectileData.position,
          projectileData.radius
        )
      ) {
        collidingPairs.add([$target, $projectile])
        usedProjectiles.add($projectile)
      }
    }
  }

  return collidingPairs
}

const isPointInsidePolygon = (
  point: CoordPair,
  polygon: CoordPair[]
): boolean => {
  let isInside = false
  const n = polygon.length

  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = polygon[i][0]
    const yi = polygon[i][1]
    const xj = polygon[j][0]
    const yj = polygon[j][1]

    if (
      yi > point[1] !== yj > point[1] &&
      point[0] < ((xj - xi) * (point[1] - yi)) / (yj - yi) + xi
    ) {
      isInside = !isInside
    }
  }

  return isInside
}

// Function to check if one polygon is completely inside another polygon
const isPolygonCompletelyInside = (
  polygon1: CoordPair[],
  polygon2: CoordPair[]
): boolean => {
  for (const vertex of polygon1) {
    if (!isPointInsidePolygon(vertex, polygon2)) {
      return false
    }
  }
  return true
}

export const arePolygonsIntersecting = (
  polygon1: CoordPair[],
  polygon2: CoordPair[]
) => {
  try {
    const intersection = martinez.intersection(
      [polygon1] as martinez.Polygon,
      [polygon2] as martinez.Polygon
    ) as martinez.Geometry | null
    if (intersection != null && intersection.length === 1) {
      return true
    }
    const inside = isPolygonCompletelyInside(polygon1, polygon2)
    if (inside) {
      return true
    }
    return false
  } catch (e) {
    console.info({ polygon1, polygon2 })
    console.error(e)
    return false
  }
}

export const detectCollisions = (
  targets: Set<TargetStore>,
  projectiles: Set<ProjectileStore>
): Set<CollisionPair> => {
  // no collisions if no targets or projectiles
  if (projectiles.size === 0 || targets.size === 0) {
    return new Set()
  }

  const sphereCollisions = detectSphereCollisions(targets, projectiles)
  if (sphereCollisions.size > 0) {
    meshPolygonCache.clear()
    for (const collidingPair of sphereCollisions) {
      const [$target, $projectile] = collidingPair

      // Ship colliding with rock (requires polygon check)
      if (isShipStore($projectile) && isRockStore($target)) {
        const shipNode = $projectile.get().shipNode
        const rockNode = $target.get().rockNode
        if (shipNode == null || rockNode == null) {
          continue
        }
        const shipPolygon = meshToPolygon(shipNode, 'ship')
        const rockPolygon = meshToPolygon(rockNode, 'rock')

        const intersects = arePolygonsIntersecting(shipPolygon, rockPolygon)

        if (!intersects) {
          sphereCollisions.delete(collidingPair)
        }
      }

      // Ship colliding with ship (requires polygon check, same as ship-rock)
      else if (isShipStore($projectile) && isShipStore($target)) {
        const shipNode1 = $projectile.get().shipNode
        const shipNode2 = $target.get().shipNode
        if (shipNode1 == null || shipNode2 == null) {
          continue
        }
        const shipPolygon1 = meshToPolygon(shipNode1, 'ship')
        const shipPolygon2 = meshToPolygon(shipNode2, 'ship')

        const intersects = arePolygonsIntersecting(shipPolygon1, shipPolygon2)

        if (!intersects) {
          sphereCollisions.delete(collidingPair)
        }
      }

      // Note: Bullet collisions (bullet-rock, bullet-ship) use sphere collision only
      // No polygon checks needed for bullets - sphere collision is sufficient
    }
  }
  return sphereCollisions
}
