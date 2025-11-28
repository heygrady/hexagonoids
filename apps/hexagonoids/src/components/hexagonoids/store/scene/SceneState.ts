import type { Mesh } from '@babylonjs/core/Meshes/mesh'
import type { Scene } from '@babylonjs/core/scene'

import type { CameraContextValue } from '../../ShipCamera'

export interface SceneState {
  scene: Scene | null
  running: boolean
  cameraContext: CameraContextValue | null
  globe: Mesh | null
}
