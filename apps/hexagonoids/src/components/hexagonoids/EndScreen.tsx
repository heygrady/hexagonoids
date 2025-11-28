import { Color3 } from '@babylonjs/core/Maths/math.color'
import { Vector3 } from '@babylonjs/core/Maths/math.vector'
import type { Node } from '@babylonjs/core/node'
import { type Component, onCleanup } from 'solid-js'

import { onAfterRender } from '../solid-babylon/hooks/onAfterRender'
import { useScene } from '../solid-babylon/hooks/useScene'

import { getCommonMaterial } from './common/commonMaterial'
import { useGame } from './hooks/useGame'
import { createTextMesh } from './hud/createTextMesh'
import { usePlayer } from './KeyboardPlayer'
import { getYawPitch } from './ship/getYawPitch'
import { moveNodeTo } from './ship/orientation'
import { useCamera } from './ShipCamera'
import { useUI } from './UI'

const allowedKeys = new Set<string>([' ', 'Spacebar'])

export const EndScreen: Component = () => {
  const scene = useScene()
  const [$game, { start }] = useGame()
  const [$player] = usePlayer()
  const hudNode = useUI()
  const { originNode: cameraOriginNode } = useCamera()

  const disposables = new Set<Node>()

  const material = getCommonMaterial(scene, {
    emissiveColor: Color3.White(),
  })

  // before the game starts
  const line1 = createTextMesh(scene, 'Game Over')
  line1.scaling.setAll(0.2)
  line1.parent = hudNode
  line1.material = material

  const line2 = createTextMesh(scene, 'press space to play again')
  line2.scaling.setAll(0.085)
  line2.parent = hudNode
  line2.position = new Vector3(0, 0, 0.15)
  line2.material = material

  let showing = false
  const hideScreen = () => {
    line1.isVisible = false
    line2.isVisible = false
    showing = false
    window.removeEventListener('keydown', handleKeyDown)
  }

  const showScreen = () => {
    line1.isVisible = true
    line2.isVisible = true
    showing = true
    window.addEventListener('keydown', handleKeyDown)
  }

  disposables.add(line1)
  disposables.add(line2)

  const handleKeyDown = (event: KeyboardEvent) => {
    if (!showing) {
      return
    }
    if (!allowedKeys.has(event.key)) {
      return
    }
    const now = Date.now()
    const endedAt = $game.get().endedAt

    // wait a second before restarting
    if (endedAt != null && now - endedAt < 1000) {
      return
    }

    hideScreen()
    start($player, scene)
    const shipPositionNode = $player.get().$ship?.get().positionNode
    if (shipPositionNode != null) {
      const [yaw, pitch] = getYawPitch(shipPositionNode.absolutePosition)
      moveNodeTo(cameraOriginNode, yaw, pitch)
    }
  }

  // start hidden
  hideScreen()

  onAfterRender(() => {
    const { alive, lives } = $player.get()
    if (!showing && !alive && lives <= 0) {
      showScreen()
    }
  })

  onCleanup(() => {
    window.removeEventListener('keydown', handleKeyDown)
    disposables.forEach((d) => {
      d.dispose()
    })
  })

  return null
}
