import { TransformNode, Vector3 } from '@babylonjs/core'
import {
  createContext,
  type Component,
  useContext,
  type JSX,
  onCleanup,
} from 'solid-js'

import { useScene } from '../solid-babylon/hooks/useScene'

import { useCamera } from './ShipCamera'

export type UIContextValue = TransformNode

export const UIContext = createContext<UIContextValue>()
export const useUI = () => {
  const context = useContext(UIContext)
  if (context == null) {
    throw new Error('useGame: cannot find a UIContext.Provider')
  }
  return context
}

export interface UIProps {
  children?: JSX.Element
}

export const UI: Component<UIProps> = (props) => {
  const scene = useScene()
  const { positionNode } = useCamera()

  // Create the hud node, place it at the face of the camera
  const hudNode = new TransformNode('hud', scene)
  hudNode.parent = positionNode
  hudNode.position = new Vector3(0, -1.5, 0)

  onCleanup(() => {
    hudNode.dispose()
  })

  return (
    <UIContext.Provider value={hudNode}>{props.children}</UIContext.Provider>
  )
}
