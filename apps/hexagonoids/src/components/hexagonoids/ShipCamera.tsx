import { latLngToVector3 } from '@heygrady/h3-babylon'
import {
  type Component,
  createContext,
  type JSX,
  onCleanup,
  useContext,
} from 'solid-js'

import { useScene, useSceneStore } from '../solid-babylon/hooks/useScene'

import { CAMERA_RADIUS, RADIUS } from './constants'
import { getYawPitch } from './ship/getYawPitch'
import { moveNodeTo } from './ship/orientation'
import {
  createSphereArenaCamera,
  type SphereArenaCamera,
} from './sphereArenaCamera/SphereArenaCamera'

export type CameraContextValue = SphereArenaCamera
export const CameraContext = createContext<CameraContextValue>()
export const useCamera = () => {
  const context = useContext(CameraContext)
  if (context == null) {
    throw new Error('useCamera: cannot find a CameraContext.Provider')
  }
  return context
}

export interface ShipCameraProps {
  children?: JSX.Element
  debug?: boolean
}

export const ShipCamera: Component<ShipCameraProps> = (props) => {
  const [, { setCameraContext }] = useSceneStore()
  const scene = useScene()

  const createCamera = () => {
    // Retrieve the globe mesh from scene state
    const [$scene] = useSceneStore()
    const globe = $scene.get().globe

    if (globe == null) {
      throw new Error(
        'ShipCamera: Globe mesh not found in scene state. Globe component must render before ShipCamera.'
      )
    }

    const sphereArenaCamera = createSphereArenaCamera('shipCamera', scene, {
      radius: CAMERA_RADIUS,
      globeRadius: RADIUS,
      globeMesh: globe,
      debug: props.debug,
    })

    // Use default starting position (ship starts at origin)
    const defaultPosition = latLngToVector3(0, 0, RADIUS)
    const position = defaultPosition.normalize().scaleInPlace(CAMERA_RADIUS)

    const [yaw, pitch] = getYawPitch(position)

    const { originNode } = sphereArenaCamera

    moveNodeTo(originNode, yaw, pitch)
    return sphereArenaCamera
  }

  const cameraContext = createCamera()

  // tell the scene about it
  setCameraContext(cameraContext)

  onCleanup(() => {
    cameraContext.camera.dispose()
    cameraContext.originNode.dispose(false, true)
  })

  return (
    <CameraContext.Provider value={cameraContext}>
      {props.children}
    </CameraContext.Provider>
  )
}
