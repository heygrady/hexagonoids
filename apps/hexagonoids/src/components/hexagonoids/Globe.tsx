import { Color3 } from '@babylonjs/core/Maths/math.color'
import { Vector3 } from '@babylonjs/core/Maths/math.vector'
import { CreateSphere } from '@babylonjs/core/Meshes/Builders/sphereBuilder'
import { type Component, onCleanup, type JSX } from 'solid-js'

import { useSceneStore } from '../solid-babylon/hooks/useScene'

import { createRes0Polyhedron } from './cell/createRes0Polyhedron'
import { getCommonMaterial } from './common/commonMaterial'
import { RADIUS } from './constants'

export interface GlobeProps {
  children?: JSX.Element
}

export const Globe: Component<GlobeProps> = (props) => {
  const [$scene, sceneActions] = useSceneStore()
  const scene = $scene.get().scene

  if (scene == null) {
    throw new Error('Globe: cannot render without a scene')
  }

  const globe = CreateSphere(
    'globe',
    { diameter: RADIUS * 2, segments: 32 },
    scene
  )
  globe.material = getCommonMaterial(scene, { alpha: 0 })
  globe.position = new Vector3(0, 0, 0)

  // Store globe reference in scene state for reliable access
  sceneActions.setGlobe(globe)

  const polyhedron = createRes0Polyhedron(scene)
  polyhedron.material = getCommonMaterial(scene, {
    alpha: 0.85,
    diffuseColor: Color3.FromHexString('#242424'),
    specularColor: Color3.FromHexString('#242424'),
    emissiveColor: Color3.FromHexString('#242424'),
  })
  polyhedron.scaling.setAll(4.8)
  polyhedron.parent = globe

  onCleanup(() => {
    ;[globe, polyhedron, polyhedron.material].forEach((node) => {
      node?.dispose()
    })
  })
  return <>{props.children}</>
}
