import type { Vector3 } from '@babylonjs/core'
import { latLngToVector3 } from '@heygrady/h3-babylon'
import {
  type Component,
  createContext,
  onCleanup,
  useContext,
  type JSX,
} from 'solid-js'

import { useScene, useSceneStore } from '../solid-babylon/hooks/useScene'

import { CAMERA_RADIUS, RADIUS } from './constants'
import { useGame } from './hooks/useGame'
import { getYawPitch } from './ship/getYawPitch'
import { moveNodeTo } from './ship/orientation'
import {
  type SphereArenaCamera,
  createSphereArenaCamera,
} from './sphereArenaCamera/SphereArenaCamera'

export type CameraContextValue = SphereArenaCamera
export const CameraContext = createContext<CameraContextValue>()
export const useCamera = () => {
  const context = useContext(CameraContext)
  if (context == null) {
    throw new Error('useGame: cannot find a CameraContext.Provider')
  }
  return context
}

export interface ShipCameraProps {
  children?: JSX.Element
}

export const ShipCamera: Component<ShipCameraProps> = (props) => {
  const [, { setCameraContext }] = useSceneStore()
  const scene = useScene()
  const [$game] = useGame()
  const { $player } = $game.get()

  if ($player == null) {
    throw new Error('ShipCamera: no player found')
  }

  const { positionNode } = $player.get().$ship?.get() ?? {}
  // if (positionNode == null) {
  //   // throw new Error('ShipCamera:  no positionNode found')
  // }

  const createCamera = (lookAt: Vector3) => {
    const sphereArenaCamera = createSphereArenaCamera('shipCamera', scene, {
      radius: CAMERA_RADIUS,
      globeRadius: RADIUS,
    })

    const position = lookAt.normalize().scaleInPlace(CAMERA_RADIUS)

    const [yaw, pitch] = getYawPitch(position)

    const { originNode } = sphereArenaCamera

    moveNodeTo(originNode, yaw, pitch)
    return sphereArenaCamera
  }

  const defaultPosition = latLngToVector3(0, 0, RADIUS)
  const cameraContext = createCamera(
    positionNode?.absolutePosition ?? defaultPosition
  )

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
