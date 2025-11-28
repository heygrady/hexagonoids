import type { Mesh } from '@babylonjs/core/Meshes/mesh'
import type { Scene } from '@babylonjs/core/scene'
import { action } from 'nanostores'
import type { OmitFirstArg } from 'nanostores/action'

import type { CameraContextValue } from '../../ShipCamera'

import type { SceneStore } from './SceneStore'

export interface SceneSetters {
  setScene: OmitFirstArg<typeof setScene>
  setCameraContext: OmitFirstArg<typeof setCameraContext>
  setGlobe: OmitFirstArg<typeof setGlobe>
}

export const bindSceneSetters = ($scene: SceneStore): SceneSetters => ({
  setScene: action($scene, 'setScene', setScene),
  setCameraContext: action($scene, 'setCameraContext', setCameraContext),
  setGlobe: action($scene, 'setGlobe', setGlobe),
})

export function setScene($scene: SceneStore, scene: Scene) {
  $scene.setKey('scene', scene)
}

export function setCameraContext(
  $scene: SceneStore,
  cameraContext: CameraContextValue
) {
  $scene.setKey('cameraContext', cameraContext)
}

export function setGlobe($scene: SceneStore, globe: Mesh) {
  $scene.setKey('globe', globe)
}
