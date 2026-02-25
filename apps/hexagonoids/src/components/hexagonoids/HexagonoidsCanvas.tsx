import type { AbstractEngineOptions } from '@babylonjs/core/Engines/abstractEngine'
import { Color4 } from '@babylonjs/core/Maths/math.color'
import type { SceneOptions } from '@babylonjs/core/scene'
import { startPlayer } from '@heygrady/hexagonoids-engine'
import { useGameState } from '@heygrady/hexagonoids-engine/solid'
import type { Component, JSX } from 'solid-js'
import { createSignal, onMount, Show } from 'solid-js'

import { type ReadyCallback, SceneCanvas } from '../solid-babylon/SceneCanvas'

import { Bullets } from './Bullets'
import { Culling } from './Culling'
import { DEFAULT_PLAYER_ID } from './constants'
import { EndScreen } from './EndScreen'
import { EngineProvider } from './engine/EngineProvider'
import { useGameLoop } from './engine/useGameLoop'
import { useInputBridge } from './engine/useInputBridge'
import { Globe } from './Globe'
import { Lights } from './Lights'
import { CameraLighting } from './NewLights'
import { Rocks } from './Rocks'
import { Score } from './Score'
import { ShipCamera } from './ShipCamera'
import { Ships } from './Ships'
import { StartScreen } from './StartScreen'
import { UI } from './UI'

const PLAYER_ID = DEFAULT_PLAYER_ID

export interface HexagonoidsCanvasProps
  extends JSX.CanvasHTMLAttributes<HTMLCanvasElement> {
  enableWebGPU?: boolean
  debug?: boolean
}

/**
 * Sets up the engine game loop and input bridge.
 * Must be rendered inside both EngineProvider and SceneContext.
 * Registered before entity components so the tick runs first.
 */
function EngineGameLoop() {
  const engine = useGameState()
  const inputs = useInputBridge()

  // Start the player once on mount (startPlayer is idempotent but side-effectful)
  onMount(() => {
    engine.mutate((state) => {
      startPlayer(state, PLAYER_ID, engine.rng)
    })
  })

  // Register the game loop tick (before entity render callbacks)
  useGameLoop(inputs, PLAYER_ID)

  return null
}

export const HexagonoidsCanvas: Component<HexagonoidsCanvasProps> = (props) => {
  const antialias = true
  const adaptToDeviceRatio = true

  const engineOptions: AbstractEngineOptions = {}
  const sceneOptions: SceneOptions = {}

  // Wait for scene to be ready
  const [ready, setReady] = createSignal<boolean>(false)
  const onReady: ReadyCallback = (scene) => {
    console.log('game ready')
    scene.clearColor = Color4.FromInts(15, 23, 41, 0.4)
    scene.skipPointerMovePicking = true
    setReady(true)
  }

  return (
    <SceneCanvas
      antialias={antialias}
      engineOptions={engineOptions}
      adaptToDeviceRatio={adaptToDeviceRatio}
      sceneOptions={sceneOptions}
      onReady={onReady}
      enableWebGPU={props.enableWebGPU}
      {...props}
    >
      <EngineProvider>
        <Show when={ready()}>
          <Globe>
            <EngineGameLoop />
            <Ships />
            <Bullets />
            <Rocks />
            <Lights />
            <ShipCamera debug={props.debug}>
              <CameraLighting>
                <Culling />
                <UI>
                  <Score />
                  <StartScreen />
                  <EndScreen />
                </UI>
              </CameraLighting>
            </ShipCamera>
          </Globe>
        </Show>
      </EngineProvider>
    </SceneCanvas>
  )
}
