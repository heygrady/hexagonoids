import {
  type Vector3,
  type Scene,
  type FreeCamera,
  Matrix,
  type AbstractMesh,
} from '@babylonjs/core'

export type ScreenCorners = [
  topLeft: Vector3,
  topRight: Vector3,
  bottomLeft: Vector3,
  bottomRight: Vector3
]

export const pickPoint = (
  screenX: number,
  screenY: number,
  scene: Scene,
  camera: FreeCamera,
  predicate: (mesh: AbstractMesh) => boolean
) => {
  const rayCaster = scene.createPickingRay(
    screenX,
    screenY,
    Matrix.Identity(),
    camera,
    false
  )

  const pickResult = scene.pickWithRay(rayCaster, predicate, false)

  if (pickResult?.hit === true && pickResult.pickedPoint != null) {
    return pickResult.pickedPoint
  } else {
    // FIXME: refactor pickPoint to always have the cameraContext
    console.log('no intersection')
    return null
  }
}
