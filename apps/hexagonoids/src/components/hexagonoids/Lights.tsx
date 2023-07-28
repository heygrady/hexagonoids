import { Vector3, Color3, DirectionalLight } from '@babylonjs/core'
import { onCleanup, type Component } from 'solid-js'

import { useScene } from '../solid-babylon/hooks/useScene'

export const Lights: Component = () => {
  const scene = useScene()
  // const intensity = 1.5
  // const hemLightUp = new HemisphericLight('hemLightUp', Vector3.Up(), scene)
  // hemLightUp.intensity = intensity
  // hemLightUp.diffuse = Color3.Magenta()
  // hemLightUp.specular = Color3.Magenta()

  // const hemLightDown = new HemisphericLight(
  //   'hemLightDown',
  //   Vector3.Down(),
  //   scene
  // )
  // hemLightDown.intensity = intensity
  // hemLightDown.diffuse = Color3.Teal()
  // hemLightDown.specular = Color3.Teal()
  // return [hemLightUp, hemLightDown]

  const dirLightUp = new DirectionalLight('dirLightUp', Vector3.Up(), scene)
  dirLightUp.intensity = 2
  dirLightUp.diffuse = Color3.Magenta()
  dirLightUp.specular = Color3.Magenta()

  const dirLightDown = new DirectionalLight(
    'dirLightDown',
    Vector3.Down(),
    scene
  )
  dirLightDown.intensity = 1.6
  dirLightDown.diffuse = Color3.Teal()
  dirLightDown.specular = Color3.Teal()

  onCleanup(() => {
    ;[dirLightUp, dirLightDown].forEach((node) => {
      node?.dispose()
    })
  })
  return null
}
