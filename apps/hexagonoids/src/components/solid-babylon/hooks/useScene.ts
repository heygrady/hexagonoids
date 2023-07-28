import { useContext } from 'solid-js'

import { SceneContext } from '../SceneContext'

export const useScene = () => {
  const [$scene] = useSceneStore()
  const scene = $scene.get().scene
  if (scene == null) {
    throw new Error('useScene: cannot find a scene')
  }
  return scene
}

export const useSceneStore = () => {
  const context = useContext(SceneContext)
  if (context == null) {
    throw new Error('useSceneStore: cannot find a SceneContext.Provider')
  }
  return context
}
