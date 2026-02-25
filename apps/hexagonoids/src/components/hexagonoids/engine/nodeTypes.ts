import type { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh'
import type { InstancedMesh } from '@babylonjs/core/Meshes/instancedMesh'
import type { TransformNode } from '@babylonjs/core/Meshes/transformNode'

export interface ShipNodes {
  originNode: TransformNode
  positionNode: TransformNode
  orientationNode: TransformNode
  shipNode: InstancedMesh
  shipTailNode: InstancedMesh
}

export interface RockNodes {
  originNode: TransformNode
  orientationNode: TransformNode
  rockNode: AbstractMesh
}

export interface BulletNodes {
  originNode: TransformNode
  bulletNode: InstancedMesh
}
