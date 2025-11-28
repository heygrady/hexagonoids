import type { FreeCamera } from '@babylonjs/core/Cameras/freeCamera'
import type { Vector3 } from '@babylonjs/core/Maths/math.vector'
import type { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh'
// Side-effect import required for scene.pick() to work with tree-shaking
import '@babylonjs/core/Culling/ray'
import type { Scene } from '@babylonjs/core/scene'

export type ScreenCorners = [
  topLeft: Vector3,
  topRight: Vector3,
  bottomLeft: Vector3,
  bottomRight: Vector3,
]

export const pickPoint = (
  screenX: number,
  screenY: number,
  scene: Scene,
  camera: FreeCamera,
  predicate: (mesh: AbstractMesh) => boolean
) => {
  // Use built-in scene.pick() which correctly handles WebGPU/WebGL NDC differences
  // This avoids the Vector3.Unproject() bug that relies on EngineStore.LastCreatedEngine
  const pickInfo = scene.pick(screenX, screenY, predicate, false, camera)

  if (pickInfo?.hit && pickInfo.pickedPoint != null) {
    return pickInfo.pickedPoint
  } else {
    // No intersection found - this is expected for miss clicks
    // Callers should handle null gracefully
    return null
  }
}
