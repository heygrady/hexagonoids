import { Quaternion, Vector3 } from '@babylonjs/core/Maths/math.vector'
import { TransformNode } from '@babylonjs/core/Meshes/transformNode'
import type { Scene } from '@babylonjs/core/scene'

import { spawnSparks } from '../bullet/spawnSparks'
import {
  EXPLOSION_LARGE_SPEED,
  EXPLOSION_SMALL_LIFETIME,
  EXPLOSION_SMALL_SPEED,
  RADIUS,
  SHIP_SCALE,
  TURN_RATE,
} from '../constants'

import { createSegmentPolygons } from './createSegmentPolygons'
import { turnNodeBy } from './orientation'

// Monotonic counter for unique mesh names; avoids non-reproducible Date.now() suffixes.
let _spawnCount = 0

/**
 * Spawn a visual-only ship explosion at the given position.
 * Creates 3 segment meshes that fly apart and self-dispose after a timeout.
 */
export function spawnExplosion(
  scene: Scene,
  shipOrientation: Quaternion,
  shipYaw: number,
  globe: TransformNode | null
): void {
  const spawnId = _spawnCount++
  const segments = createSegmentPolygons(scene, `explosion_${spawnId}`)
  const spawnedAt = Date.now()

  const segmentData: Array<{
    originNode: TransformNode
    orientationNode: TransformNode
    angularVelocity: Vector3
    spinDirection: 1 | -1
    lifetime: number
    disposed: boolean
  }> = []

  for (const segmentMesh of segments) {
    segmentMesh.scaling.setAll(SHIP_SCALE)
    turnNodeBy(segmentMesh, -Math.PI / 2)

    const originNode = new TransformNode(
      `explosionOrigin_${segmentMesh.name}`,
      scene
    )
    originNode.rotationQuaternion = shipOrientation.clone()

    const positionNode = new TransformNode(
      `explosionPos_${segmentMesh.name}`,
      scene
    )
    positionNode.position.y = RADIUS

    const orientationNode = new TransformNode(
      `explosionOrient_${segmentMesh.name}`,
      scene
    )
    orientationNode.rotationQuaternion = Quaternion.RotationYawPitchRoll(
      shipYaw,
      0,
      0
    )

    if (globe != null) {
      originNode.parent = globe
    }
    positionNode.parent = originNode
    orientationNode.parent = positionNode
    segmentMesh.parent = orientationNode

    // Random heading and speed for this segment
    const heading = shipYaw + (Math.random() * Math.PI - Math.PI / 2)
    const speed =
      EXPLOSION_LARGE_SPEED + Math.random() * EXPLOSION_LARGE_SPEED * 2

    // Convert heading to world-space angular velocity
    const worldUp = Vector3.Up().applyRotationQuaternion(
      originNode.rotationQuaternion
    )
    const localHeadingRotation = Quaternion.RotationAxis(Vector3.Up(), heading)
    const localHeading3D =
      Vector3.Forward().applyRotationQuaternion(localHeadingRotation)
    const worldHeading = localHeading3D.applyRotationQuaternion(
      originNode.rotationQuaternion
    )
    const rotationAxis = Vector3.Cross(worldUp, worldHeading)
    const axisLen = rotationAxis.length()
    let angularVelocity = Vector3.Zero()
    if (axisLen > 0.00001) {
      rotationAxis.scaleInPlace(1 / axisLen)
      angularVelocity = rotationAxis.scale(speed)
    }

    // Random spin direction (left or right), matching old behavior
    const spinDirection: 1 | -1 = Math.random() < 0.5 ? -1 : 1

    // Each segment gets a random lifetime (300ms–900ms), matching old behavior
    const lifetime =
      EXPLOSION_SMALL_LIFETIME + Math.random() * EXPLOSION_SMALL_LIFETIME * 2

    segmentData.push({
      originNode,
      orientationNode,
      angularVelocity,
      spinDirection,
      lifetime,
      disposed: false,
    })
  }

  // Spawn spark debris at the ship's position
  spawnSparks(
    scene,
    shipOrientation,
    EXPLOSION_SMALL_SPEED,
    EXPLOSION_SMALL_LIFETIME,
    globe
  )

  // Animate segments each frame
  const observer = scene.onBeforeRenderObservable.add(() => {
    const elapsed = Date.now() - spawnedAt
    let allDisposed = true

    const dtMs = scene.getEngine().getDeltaTime()
    const dtSeconds = dtMs / 1000

    for (let i = 0; i < segmentData.length; i++) {
      const seg = segmentData[i]
      if (seg.disposed) continue

      // Check per-segment lifetime
      if (elapsed > seg.lifetime) {
        const segMesh = segments[i]
        const orient = segMesh.parent
        const pos = orient?.parent
        const origin = pos?.parent
        segMesh.dispose(false, true)
        orient?.dispose()
        pos?.dispose()
        origin?.dispose()
        seg.disposed = true
        continue
      }

      allDisposed = false

      // Spin the segment locally (random left/right turn)
      if (seg.orientationNode.rotationQuaternion != null) {
        const spinAngle = seg.spinDirection * TURN_RATE * dtSeconds
        seg.orientationNode.rotationQuaternion =
          seg.orientationNode.rotationQuaternion.multiply(
            Quaternion.RotationYawPitchRoll(spinAngle, 0, 0)
          )
      }

      // Move the segment across the sphere
      if (seg.originNode.rotationQuaternion == null) continue
      const speed = seg.angularVelocity.length()
      if (speed < 0.00001) continue

      const angle = speed * dtSeconds
      const axis = seg.angularVelocity.scale(1 / speed)
      const frameRotation = Quaternion.RotationAxis(axis, angle)

      seg.originNode.rotationQuaternion = frameRotation.multiply(
        seg.originNode.rotationQuaternion
      )
      seg.originNode.rotationQuaternion.normalize()
    }

    if (allDisposed) {
      scene.onBeforeRenderObservable.remove(observer)
    }
  })
}
