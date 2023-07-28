import { map, type MapStore } from 'nanostores'

import type { SceneState } from './SceneState'

export type SceneStore = MapStore<SceneState>

export const createSceneStore = (): SceneStore => {
  const $scene = map<SceneState>({
    scene: null,
    running: false,
    cameraContext: null,
  })
  return $scene
}
