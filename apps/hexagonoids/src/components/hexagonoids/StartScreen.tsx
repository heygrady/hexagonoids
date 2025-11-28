import type { Material } from '@babylonjs/core/Materials/material'
import { Color3 } from '@babylonjs/core/Maths/math.color'
import { Vector3 } from '@babylonjs/core/Maths/math.vector'
import type { Node } from '@babylonjs/core/node'
import { type Component, onCleanup } from 'solid-js'

import { useScene } from '../solid-babylon/hooks/useScene'

import { getCommonMaterial } from './common/commonMaterial'
import { useGame } from './hooks/useGame'
import { createTextMesh } from './hud/createTextMesh'
import { usePlayer } from './KeyboardPlayer'
import { getYawPitch } from './ship/getYawPitch'
import { moveNodeTo } from './ship/orientation'
import { useCamera } from './ShipCamera'
import { useUI } from './UI'

export const allowedKeys = new Set([
  'a',
  'A',
  'ArrowLeft',
  'd',
  'D',
  'ArrowRight',
  'w',
  'W',
  'ArrowUp',
  's',
  'S',
  'ArrowDown',
  ' ',
  'Space',
])

export const StartScreen: Component = () => {
  const scene = useScene()
  const [, { start }] = useGame()
  const [$player] = usePlayer()
  const hudNode = useUI()
  const { originNode: cameraOriginNode } = useCamera()

  const disposables = new Set<Node | Material>()

  const material = getCommonMaterial(scene, {
    emissiveColor: Color3.White(),
  })

  // before the game starts
  const line1 = createTextMesh(scene, 'Hexagonoids')
  line1.scaling.setAll(0.2)
  line1.parent = hudNode
  line1.material = material

  const line2 = createTextMesh(scene, 'press space to start')
  line2.scaling.setAll(0.085)
  line2.parent = hudNode
  line2.position = new Vector3(0, 0, 0.15)
  line2.material = material

  const hideScreen = () => {
    line1.dispose()
    line2.dispose()
  }

  disposables.add(line1)
  disposables.add(line2)

  const handleKeyDown = (event: KeyboardEvent) => {
    if (!allowedKeys.has(event.key)) {
      return
    }
    hideScreen()
    start($player, scene)
    const shipPositionNode = $player.get().$ship?.get().positionNode
    if (shipPositionNode != null) {
      const [yaw, pitch] = getYawPitch(shipPositionNode.absolutePosition)
      moveNodeTo(cameraOriginNode, yaw, pitch)
    }
    window.removeEventListener('keydown', handleKeyDown)
  }

  window.addEventListener('keydown', handleKeyDown)

  onCleanup(() => {
    window.removeEventListener('keydown', handleKeyDown)
    disposables.forEach((d) => {
      d.dispose()
    })
  })
  return null
}
