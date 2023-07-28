import { onCleanup } from 'solid-js'

import { useScene } from './useScene'

export const onAfterRender = (callback: () => void) => {
  const scene = useScene()

  scene.registerAfterRender(callback)

  onCleanup(() => {
    scene.unregisterAfterRender(callback)
  })
}
