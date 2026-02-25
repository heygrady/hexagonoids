import { Color3 } from '@babylonjs/core/Maths/math.color'
import { Vector3 } from '@babylonjs/core/Maths/math.vector'
import type { Node } from '@babylonjs/core/node'
import { latLngToVector3 } from '@heygrady/h3-babylon'
import { startPlayer } from '@heygrady/hexagonoids-engine'
import { useGameOver, useGameState } from '@heygrady/hexagonoids-engine/solid'
import { type Component, onCleanup } from 'solid-js'

import { useScene } from '../solid-babylon/hooks/useScene'

import { getCommonMaterial } from './common/commonMaterial'
import { DEFAULT_PLAYER_ID, RADIUS } from './constants'
import { createTextMesh } from './hud/createTextMesh'
import { useCamera } from './ShipCamera'
import { getYawPitch } from './ship/getYawPitch'
import { moveNodeTo } from './ship/orientation'
import { useUI } from './UI'

const allowedKeys = new Set<string>([' ', 'Spacebar'])

const PLAYER_ID = DEFAULT_PLAYER_ID

export const EndScreen: Component = () => {
  const scene = useScene()
  const engine = useGameState()
  const hudNode = useUI()
  const { originNode: cameraOriginNode } = useCamera()
  const gameOver = useGameOver(engine)

  const disposables = new Set<Node>()

  const material = getCommonMaterial(scene, {
    emissiveColor: Color3.White(),
  })

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

    // Wait a second before allowing restart
    const endedAt = engine.state.endedAt
    if (endedAt != null && engine.state.now - endedAt < 1000) {
      return
    }

    hideScreen()

    // Restart the game via engine. All clears + startPlayer run in one batch so
    // SolidJS sees the final state atomically: old <For> items are removed (pool
    // released) before new items are added (pool acquired). SolidJS processes
    // removals before additions in <For>, so pool ordering is safe.
    engine.mutate((state) => {
      state.endedAt = null
      state.players.delete(PLAYER_ID)
      state.ships.clear()
      state.rocks.clear()
      state.bullets.clear()
      startPlayer(state, PLAYER_ID, engine.rng)
      state.startedAt = state.now
    })

    // Move camera to the new ship position
    const player = engine.state.players.get(PLAYER_ID)
    if (player?.shipId != null) {
      const ship = engine.state.ships.get(player.shipId)
      if (ship != null) {
        const pos = latLngToVector3(ship.lat, ship.lng, RADIUS)
        const [yaw, pitch] = getYawPitch(pos)
        moveNodeTo(cameraOriginNode, yaw, pitch)
      }
    }
  }

  // Start hidden
  hideScreen()

  const observer = scene.onBeforeRenderObservable.add(() => {
    if (!showing && gameOver()) {
      showScreen()
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
