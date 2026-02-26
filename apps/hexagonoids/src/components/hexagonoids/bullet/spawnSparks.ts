import { Quaternion, Vector3 } from '@babylonjs/core/Maths/math.vector'
import type { Mesh } from '@babylonjs/core/Meshes/mesh'
import { TransformNode } from '@babylonjs/core/Meshes/transformNode'
import type { Scene } from '@babylonjs/core/scene'

import { BULLET_SCALE, RADIUS } from '../constants'

// Monotonic counter for unique mesh names; avoids non-reproducible Date.now() suffixes.
let _spawnCount = 0

import { pitchNodeBy } from '../ship/orientation'

import { initializeBulletMaster } from './createBulletNodes'

const SPARK_COUNT = 6

interface SparkData {
  originNode: TransformNode
  angularVelocity: Vector3
  lifetime: number
  disposed: boolean
}

/**
 * Spawn visual-only spark bullets at the given position.
 * Creates 6 bullet-like sparks that fly outward and self-dispose.
 *
 * @param scene - The Babylon scene
 * @param orientation - Position quaternion on the sphere
 * @param speed - Base speed for sparks (e.g. EXPLOSION_SMALL_SPEED)
 * @param lifetime - Base lifetime in ms (e.g. EXPLOSION_SMALL_LIFETIME)
 * @param globe - Globe mesh to parent sparks to
 */
export function spawnSparks(
  scene: Scene,
  orientation: Quaternion,
  speed: number,
  lifetime: number,
  globe: TransformNode | null
): void {
  // Ensure bullet master exists
  initializeBulletMaster(scene)
  const master = scene.getMeshByName('bulletMaster') as Mesh | null
  if (master == null) return

  const spawnId = _spawnCount++
  const spawnedAt = Date.now()
  const sparks: SparkData[] = []

  for (let i = 0; i < SPARK_COUNT; i++) {
    const bulletNode = master.createInstance(`spark_${spawnId}_${i}`)

    const originNode = new TransformNode(`sparkOrigin_${spawnId}_${i}`, scene)
    originNode.rotationQuaternion = orientation.clone()
    bulletNode.parent = originNode
    bulletNode.position.y = RADIUS
    pitchNodeBy(bulletNode, Math.PI / 2)

    if (globe != null) {
      originNode.parent = globe
    }

    bulletNode.scaling.setAll(BULLET_SCALE)
    bulletNode.isVisible = true

    // Random heading and speed
    const randomHeading = Math.random() * Math.PI * 2 - Math.PI
    const sparkSpeed = speed + Math.random() * speed

    // Convert heading to world-space angular velocity
    const worldUp = Vector3.Up().applyRotationQuaternion(
      originNode.rotationQuaternion
    )
    const localHeadingRotation = Quaternion.RotationAxis(
      Vector3.Up(),
      randomHeading
    )
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
      angularVelocity = rotationAxis.scale(sparkSpeed)
    }

    // Each spark gets its own random lifetime
    const sparkLifetime = lifetime + Math.random() * lifetime

    sparks.push({
      originNode,
      angularVelocity,
      lifetime: sparkLifetime,
      disposed: false,
    })
  }

  // Animate sparks each frame
  const observer = scene.onBeforeRenderObservable.add(() => {
    const elapsed = Date.now() - spawnedAt
    let allDisposed = true

    const dtSeconds = scene.getEngine().getDeltaTime() / 1000

    for (const spark of sparks) {
      if (spark.disposed) continue

      if (elapsed > spark.lifetime) {
        const bulletNode = spark.originNode.getChildMeshes()[0]
        bulletNode?.dispose(false, true)
        spark.originNode.dispose()
        spark.disposed = true
        continue
      }

      allDisposed = false

      if (spark.originNode.rotationQuaternion == null) continue
      const spd = spark.angularVelocity.length()
      if (spd < 0.00001) continue

      const angle = spd * dtSeconds
      const axis = spark.angularVelocity.scale(1 / spd)
      const frameRotation = Quaternion.RotationAxis(axis, angle)

      spark.originNode.rotationQuaternion = frameRotation.multiply(
        spark.originNode.rotationQuaternion
      )
      spark.originNode.rotationQuaternion.normalize()
    }

    if (allDisposed) {
      scene.onBeforeRenderObservable.remove(observer)
    }
  })
}
