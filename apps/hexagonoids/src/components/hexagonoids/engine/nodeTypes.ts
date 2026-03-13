import type { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh'
import type { InstancedMesh } from '@babylonjs/core/Meshes/instancedMesh'
import type { Mesh } from '@babylonjs/core/Meshes/mesh'
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

export interface CellNodes {
  originNode: TransformNode
  positionNode: TransformNode
  cellNode: Mesh | null
  currentH: string
}
