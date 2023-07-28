import type { Scene } from '@babylonjs/core'

import type { CameraContextValue } from '../../ShipCamera'

export interface SceneState {
  scene: Scene | null
  running: boolean
  cameraContext: CameraContextValue | null
}
