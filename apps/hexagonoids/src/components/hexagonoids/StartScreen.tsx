import type { Material } from '@babylonjs/core/Materials/material'
import { Color3 } from '@babylonjs/core/Maths/math.color'
import { Vector3 } from '@babylonjs/core/Maths/math.vector'
import type { Node } from '@babylonjs/core/node'
import { latLngToVector3 } from '@heygrady/h3-babylon'
import { restartGame } from '@heygrady/hexagonoids-engine'
import { useGameState } from '@heygrady/hexagonoids-engine/solid'
import { type Component, onCleanup } from 'solid-js'

import { useScene } from '../solid-babylon/hooks/useScene'

import { getCommonMaterial } from './common/commonMaterial'
import { DEFAULT_PLAYER_ID, RADIUS } from './constants'
import { useInputs } from './engine/useInputBridge'
import { createTextMesh } from './hud/createTextMesh'
import { useAppMode } from './modes/AppModeProvider'
import { useCamera } from './ShipCamera'
import { getYawPitch } from './ship/getYawPitch'
import { moveNodeTo } from './ship/orientation'
import { useUI } from './UI'

const allowedKeys = new Set([
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

const PLAYER_ID = DEFAULT_PLAYER_ID

export const StartScreen: Component = () => {
  const scene = useScene()
  const engine = useGameState()
  const inputs = useInputs()
  const { setAppMode } = useAppMode()
  const hudNode = useUI()
  const { originNode: cameraOriginNode } = useCamera()

  const disposables = new Set<Node | Material>()

  const material = getCommonMaterial(scene, {
    emissiveColor: Color3.White(),
  })

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
    // Shift+R enters record mode
    if (event.shiftKey && event.key === 'R') {
      event.preventDefault()
      hideScreen()
      inputs.reset()
      setAppMode('record')
      window.removeEventListener('keydown', handleKeyDown)
      return
    }

    if (!allowedKeys.has(event.key)) {
      return
    }
    event.preventDefault()
    hideScreen()

    // Clear attract-mode rocks and start a fresh game
    inputs.reset()
    engine.mutate((state) => {
      restartGame(state, PLAYER_ID, engine.rng)
    })

    // Move camera to the player's ship position
    const player = engine.state.players.get(PLAYER_ID)
    if (player?.shipId != null) {
      const ship = engine.state.ships.get(player.shipId)
      if (ship != null) {
        const pos = latLngToVector3(ship.lat, ship.lng, RADIUS)
        const [yaw, pitch] = getYawPitch(pos)
        moveNodeTo(cameraOriginNode, yaw, pitch)
      }
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
