import type { Material } from '@babylonjs/core/Materials/material'
import { Color3 } from '@babylonjs/core/Maths/math.color'
import { Vector3 } from '@babylonjs/core/Maths/math.vector'
import type { Node } from '@babylonjs/core/node'
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
const START_SCREEN_INPUT_GUARD_MS = 350

export const StartScreen: Component = () => {
  const scene = useScene()
  const engine = useGameState()
  const inputs = useInputs()
  const { appMode, setAppMode } = useAppMode()
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

  const hintMaterial = getCommonMaterial(scene, {
    emissiveColor: new Color3(0.5, 0.5, 0.5),
  })

  // Only show the record/playback hint in dev mode — not in production builds
  const line3 = import.meta.env.DEV
    ? createTextMesh(scene, 'Shift+O: Observe | Shift+S: Spawn Debug')
    : null
  if (line3 != null) {
    line3.scaling.setAll(0.045)
    line3.parent = hudNode
    line3.position = new Vector3(0, 0, 0.25)
    line3.material = hintMaterial
  }

  let showing = false
  let allowInputAt = 0
  const hideScreen = () => {
    line1.isVisible = false
    line2.isVisible = false
    if (line3 != null) line3.isVisible = false
    if (!showing) return
    showing = false
    window.removeEventListener('keydown', handleKeyDown)
  }

  const showScreen = () => {
    if (showing) return
    line1.isVisible = true
    line2.isVisible = true
    if (line3 != null) line3.isVisible = true
    showing = true
    allowInputAt = performance.now() + START_SCREEN_INPUT_GUARD_MS
    window.addEventListener('keydown', handleKeyDown)
  }

  disposables.add(line1)
  disposables.add(line2)
  if (line3 != null) disposables.add(line3)
  disposables.add(hintMaterial)

  const handleKeyDown = (event: KeyboardEvent) => {
    if (!showing) return
    if (performance.now() < allowInputAt) return

    // Shift+R enters record mode
    if (event.shiftKey && event.key === 'R') {
      event.preventDefault()
      hideScreen()
      inputs.reset()
      setAppMode('record')
      window.removeEventListener('keydown', handleKeyDown)
      return
    }

    // Shift+P enters playback mode
    if (event.shiftKey && event.key === 'P') {
      event.preventDefault()
      hideScreen()
      inputs.reset()
      setAppMode('playback')
      window.removeEventListener('keydown', handleKeyDown)
      return
    }

    // Shift+S enters spawn-debug mode
    if (event.shiftKey && event.key === 'S') {
      event.preventDefault()
      hideScreen()
      inputs.reset()
      setAppMode('spawn-debug')
      window.removeEventListener('keydown', handleKeyDown)
      return
    }

    // Shift+O enters observe mode
    if (event.shiftKey && event.key === 'O') {
      event.preventDefault()
      hideScreen()
      inputs.reset()
      setAppMode('observe')
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
        const pos = new Vector3(
          ship.x * RADIUS,
          ship.y * RADIUS,
          ship.z * RADIUS
        )
        const [yaw, pitch] = getYawPitch(pos)
        moveNodeTo(cameraOriginNode, yaw, pitch)
      }
    }

    window.removeEventListener('keydown', handleKeyDown)
  }

  hideScreen()

  const observer = scene.onBeforeRenderObservable.add(() => {
    const shouldShow = appMode() === 'play' && engine.state.players.size === 0
    if (shouldShow) {
      showScreen()
    } else {
      hideScreen()
    }
  })

  onCleanup(() => {
    scene.onBeforeRenderObservable.remove(observer)
    window.removeEventListener('keydown', handleKeyDown)
    disposables.forEach((d) => {
      d.dispose()
    })
  })

  return null
}
