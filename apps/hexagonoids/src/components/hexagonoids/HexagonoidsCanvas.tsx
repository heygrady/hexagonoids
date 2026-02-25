import type { AbstractEngineOptions } from '@babylonjs/core/Engines/abstractEngine'
import { Color4 } from '@babylonjs/core/Maths/math.color'
import type { SceneOptions } from '@babylonjs/core/scene'
import { startPlayer } from '@heygrady/hexagonoids-engine'
import { useGameState } from '@heygrady/hexagonoids-engine/solid'
import type { Component, JSX } from 'solid-js'
import { createSignal, Show } from 'solid-js'

import { type ReadyCallback, SceneCanvas } from '../solid-babylon/SceneCanvas'

import { Bullets } from './Bullets'
import { Cells } from './Cells'
import { Culling } from './Culling'
import { DEFAULT_PLAYER_ID } from './constants'
import { EndScreen } from './EndScreen'
import { EngineProvider } from './engine/EngineProvider'
import { useGameLoop } from './engine/useGameLoop'
import { useInputBridge } from './engine/useInputBridge'
import { GameContext } from './GameContext'
import { Globe } from './Globe'
import { KeyboardPlayer } from './KeyboardPlayer'
import { Lights } from './Lights'
import { CameraLighting } from './NewLights'
import { Rocks } from './Rocks'
import { Score } from './Score'
import { ShipCamera } from './ShipCamera'
import { Ships } from './Ships'
import { StartScreen } from './StartScreen'
import { bindGameActions, type GameActions } from './store/game/GameActions'
import { createGameStore, type GameStore } from './store/game/GameStore'
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

  // Start the player in the engine
  engine.mutate((state) => {
    startPlayer(state, PLAYER_ID, engine.rng)
  })

  // Register the game loop tick (before entity render callbacks)
  useGameLoop(inputs, PLAYER_ID)

  return null
}

export const HexagonoidsCanvas: Component<HexagonoidsCanvasProps> = (props) => {
  const $game = createGameStore()
  const gameActions = bindGameActions($game)
  const gameContext: [$game: GameStore, actions: GameActions] = [
    $game,
    gameActions,
  ]

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
      <GameContext.Provider value={gameContext}>
        <EngineProvider>
          <Show when={ready()}>
            <Globe>
              <EngineGameLoop />
              <Ships />
              <Bullets />
              <Rocks />
              <Cells />
              <Lights />
              <KeyboardPlayer>
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
              </KeyboardPlayer>
            </Globe>
          </Show>
        </EngineProvider>
      </GameContext.Provider>
    </SceneCanvas>
  )
}
