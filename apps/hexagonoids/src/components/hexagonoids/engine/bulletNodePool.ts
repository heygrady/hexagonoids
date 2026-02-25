import { Quaternion, Vector3 } from '@babylonjs/core/Maths/math.vector'
import type { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh'
import type { Mesh } from '@babylonjs/core/Meshes/mesh'
import { TransformNode } from '@babylonjs/core/Meshes/transformNode'
import type { Scene } from '@babylonjs/core/scene'

import { initializeBulletMaster } from '../bullet/createBulletNodes'
import { BULLET_CACHE_SIZE, BULLET_SCALE, RADIUS } from '../constants'
import { ObjectPool } from '../pool/ObjectPool'
import { pitchNodeBy } from '../ship/orientation'

import type { BulletNodes } from './nodeTypes'

export function createBulletNodePool(
  scene: Scene,
  globe: AbstractMesh | null = null
): ObjectPool<BulletNodes> {
  // Scoped to factory call — resets cleanly on HMR when pool is recreated
  let bulletMaster: Mesh | null = null
  let poolCounter = 0

  function getBulletMaster(): Mesh {
    if (bulletMaster == null) {
      initializeBulletMaster(scene)
      bulletMaster = scene.getMeshByName('bulletMaster') as Mesh | null
      if (bulletMaster == null) {
        throw new Error('bulletMaster not found after initialization')
      }
    }
    return bulletMaster
  }

  function createBulletNodeBundle(): BulletNodes {
    const id = `pool_bullet_${poolCounter++}`
    const master = getBulletMaster()

    const bulletNode = master.createInstance(`bullet_${id}`)

    const originNode = new TransformNode(`bulletOrigin_${id}`)
    originNode.rotationQuaternion = Quaternion.Identity()
    bulletNode.parent = originNode
    bulletNode.position.y = RADIUS

    pitchNodeBy(bulletNode, Math.PI / 2)

    if (globe != null) {
      originNode.parent = globe
    }

    bulletNode.scaling = new Vector3(BULLET_SCALE, BULLET_SCALE, BULLET_SCALE)

    // Start hidden — acquire will show
    bulletNode.isVisible = false
    originNode.setEnabled(false)

    return { originNode, bulletNode }
  }

  return new ObjectPool<BulletNodes>({
    maxSize: BULLET_CACHE_SIZE,
    getScene: () => scene,
    createFn: () => createBulletNodeBundle(),
    resetFn: (nodes) => {
      nodes.bulletNode.isVisible = false
      nodes.originNode.setEnabled(false)
      nodes.originNode.rotationQuaternion =
        nodes.originNode.rotationQuaternion ?? Quaternion.Identity()
      nodes.originNode.rotationQuaternion.copyFrom(Quaternion.Identity())
      return nodes
    },
    disposeFn: (nodes) => {
      nodes.bulletNode.dispose(false, true)
      nodes.originNode.dispose()
    },
    keyFn: (nodes) => nodes.originNode.name,
    name: 'BulletNodePool',
  })
}
