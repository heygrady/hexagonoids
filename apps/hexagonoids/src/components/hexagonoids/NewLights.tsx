import { SpotLight } from '@babylonjs/core/Lights/spotLight'
import { Color3 } from '@babylonjs/core/Maths/math.color'
import { Vector3 } from '@babylonjs/core/Maths/math.vector'
import { TransformNode } from '@babylonjs/core/Meshes/transformNode'
import { vector3ToLatLng } from '@heygrady/h3-babylon'
import { cellToLatLng, latLngToCell } from 'h3-js'
import {
  type Component,
  createContext,
  onCleanup,
  type JSX,
  useContext,
} from 'solid-js'

import { onBeforeRender } from '../solid-babylon/hooks/onBeforeRender'
import { useScene } from '../solid-babylon/hooks/useScene'

import { getCommonMaterial } from './common/commonMaterial'
import { CAMERA_RADIUS, RADIUS, SPOTLIGHT_HEIGHT } from './constants'
import { useCamera } from './ShipCamera'

export interface SpotlightContextValue {
  spotlight: SpotLight
  originNode: TransformNode
  positionNode: TransformNode
}

export const SpotlightContext = createContext<SpotlightContextValue>()

export const useSpotlight = () => {
  const context = useContext(SpotlightContext)
  if (context == null) {
    throw new Error('useSpotlight: cannot find a SpotlightContext.Provider')
  }
  return context
}

export const blendColors = (
  color1: Color3,
  color2: Color3,
  blendFactor: number
): Color3 => {
  blendFactor = Math.min(1, Math.max(0, blendFactor)) // Clamp the blend factor between 0 and 1

  // Interpolate the color components using the blend factor
  const r = color1.r + (color2.r - color1.r) * blendFactor
  const g = color1.g + (color2.g - color1.g) * blendFactor
  const b = color1.b + (color2.b - color1.b) * blendFactor

  return new Color3(r, g, b)
}

export interface CameraLightingProps {
  children?: JSX.Element
}

export const CameraLighting: Component<CameraLightingProps> = (props) => {
  const scene = useScene()
  const cameraContext = useCamera()

  // place a spotlight light relative to the camera position
  const direction = Vector3.Down()
  const position = Vector3.Zero()
  const coneAngle = Math.PI / 3.5
  const decaySpeedExponent = 2

  // one spotlight behind the camera
  const spotlightOriginNode = new TransformNode('spotlightOriginNode', scene)
  spotlightOriginNode.parent = cameraContext.positionNode
  spotlightOriginNode.rotationQuaternion =
    cameraContext.camera.rotationQuaternion

  const spotlightPositionNode = new TransformNode(
    'spotlightPositionNode',
    scene
  )
  spotlightPositionNode.parent = spotlightOriginNode

  const spotlight = new SpotLight(
    'spotlight',
    position,
    direction,
    coneAngle,
    decaySpeedExponent,
    scene
  )
  spotlight.parent = spotlightPositionNode

  // move the spotlight behind the camera
  spotlightPositionNode.position.y = SPOTLIGHT_HEIGHT

  const intensity = 3.7
  spotlight.intensity = intensity
  spotlight.range = CAMERA_RADIUS + RADIUS + SPOTLIGHT_HEIGHT

  // colors
  const color = blendColors(Color3.Magenta(), Color3.Teal(), 0.5)
  spotlight.diffuse = color
  spotlight.specular = color

  let prevCell: string | null = null
  let lastMaterialUpdate = 0
  const MATERIAL_UPDATE_THROTTLE = 16 // ~60fps, throttle material updates to reduce GPU pressure

  onBeforeRender(() => {
    const position = spotlightPositionNode.absolutePosition
    const location = vector3ToLatLng(position)
    const cell = latLngToCell(location[0], location[1], 2)
    if (cell === prevCell) {
      return
    }
    prevCell = cell
    const [lat] = cellToLatLng(cell)
    // convert north pole to 1, south pole to 0
    const blendFactor = (lat + 90) / 180
    const intensityFactor = 1 - Math.abs((blendFactor - 0.5) * 2)
    spotlight.intensity = intensityFactor * intensity
    const color = blendColors(Color3.Magenta(), Color3.Teal(), blendFactor)
    spotlight.diffuse = color
    spotlight.specular = color

    // Throttle material updates to reduce WebGPU command buffer pressure
    const now = performance.now()
    if (now - lastMaterialUpdate > MATERIAL_UPDATE_THROTTLE) {
      // Update shared material color for all rocks, ships, and bullets
      const commonMaterial = getCommonMaterial(scene)
      commonMaterial.diffuseColor = color
      lastMaterialUpdate = now
    }
  })

  const spotlightContextValue: SpotlightContextValue = {
    spotlight,
    originNode: spotlightOriginNode,
    positionNode: spotlightPositionNode,
  }

  onCleanup(() => {
    Object.values(spotlightContextValue).forEach((n) => {
      n.dispose()
    })
  })
  return (
    <SpotlightContext.Provider value={spotlightContextValue}>
      {props.children}
    </SpotlightContext.Provider>
  )
}
