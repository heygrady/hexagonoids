import { onCleanup } from 'solid-js'

import { useScene } from './useScene'

export const onBeforeRender = (callback: () => void) => {
  const scene = useScene()

  scene.registerBeforeRender(callback)

  onCleanup(() => {
    scene.unregisterBeforeRender(callback)
  })
}
