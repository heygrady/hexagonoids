import { latLngToVector3 } from '@heygrady/h3-babylon'
import { useGameState } from '@heygrady/hexagonoids-engine/solid'
import {
  type Component,
  createContext,
  type JSX,
  onCleanup,
  useContext,
} from 'solid-js'

import { useScene, useSceneStore } from '../solid-babylon/hooks/useScene'
import { CAMERA_RADIUS, DEFAULT_PLAYER_ID, RADIUS } from './constants'
import { useNodeRegistry } from './NodeRegistry'
import { getYawPitch } from './ship/getYawPitch'
import { moveCamera } from './ship/moveCamera'
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

const PLAYER_ID = DEFAULT_PLAYER_ID

export const ShipCamera: Component<ShipCameraProps> = (props) => {
  const [, { setCameraContext }] = useSceneStore()
  const scene = useScene()
  const engine = useGameState()
  const registry = useNodeRegistry()

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

  // Per-frame camera tracking: follow the player's ship
  const trackingObserver = scene.onBeforeRenderObservable.add(() => {
    const player = engine.state.players.get(PLAYER_ID)
    if (player?.shipId == null) return
    const entry = registry.get(`ship:${player.shipId}`)
    if (entry?.positionNode == null) return
    const delta = scene.getEngine().getDeltaTime()
    moveCamera(entry.positionNode, delta)
  })

  onCleanup(() => {
    scene.onBeforeRenderObservable.remove(trackingObserver)
    cameraContext.camera.dispose()
    cameraContext.originNode.dispose(false, true)
  })

  return (
    <CameraContext.Provider value={cameraContext}>
      {props.children}
    </CameraContext.Provider>
  )
}
