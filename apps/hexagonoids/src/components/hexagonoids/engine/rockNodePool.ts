import { Quaternion } from '@babylonjs/core/Maths/math.vector'
import type { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh'
import type { Scene } from '@babylonjs/core/scene'

import { ROCK_CACHE_SIZE } from '../constants'
import { ObjectPool } from '../pool/ObjectPool'
import { createRockNodes } from '../rock/createRockNodes'

import type { RockNodes } from './nodeTypes'

export function createRockNodePool(
  scene: Scene,
  globe: AbstractMesh | null = null
): ObjectPool<RockNodes> {
  // Scoped to factory call — resets cleanly on HMR when pool is recreated
  let poolCounter = 0

  return new ObjectPool<RockNodes>({
    maxSize: ROCK_CACHE_SIZE,
    getScene: () => scene,
    createFn: (s) => {
      const id = `pool_rock_${poolCounter++}`
      const nodes = createRockNodes(s, id, globe)
      // Start hidden — acquire will show
      nodes.rockNode.isVisible = false
      nodes.originNode.setEnabled(false)
      return nodes
    },
    resetFn: (nodes) => {
      nodes.rockNode.isVisible = false
      nodes.originNode.setEnabled(false)
      nodes.originNode.rotationQuaternion =
        nodes.originNode.rotationQuaternion ?? Quaternion.Identity()
      nodes.originNode.rotationQuaternion.copyFrom(Quaternion.Identity())
      return nodes
    },
    disposeFn: (nodes) => {
      nodes.rockNode.material?.dispose(true, true)
      nodes.rockNode.dispose(false, true)
      nodes.orientationNode.dispose()
      nodes.originNode.dispose()
    },
    keyFn: (nodes) => nodes.originNode.name,
    name: 'RockNodePool',
  })
}
