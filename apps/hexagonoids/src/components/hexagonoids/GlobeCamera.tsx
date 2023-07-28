import { Vector3, ArcRotateCamera } from '@babylonjs/core'
import { onCleanup, type Component } from 'solid-js'

import { useScene } from '../solid-babylon/hooks/useScene'

export const GlobeCamera: Component = () => {
  const scene = useScene()
  // Set up the camera
  const camera = new ArcRotateCamera(
    'camera',
    Math.PI,
    0,
    15,
    Vector3.Zero(),
    scene
  )
  camera.allowUpsideDown = false

  const canvas = scene.getEngine().getRenderingCanvas()

  // This attaches the camera to the canvas
  camera.attachControl(canvas, true)

  onCleanup(() => {
    camera.dispose()
  })
  return null
}
