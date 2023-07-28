import { type EngineOptions, type SceneOptions, Color4 } from '@babylonjs/core'
import type { Component, JSX } from 'solid-js'
import { Show, createSignal } from 'solid-js'

import { type ReadyCallback, SceneCanvas } from '../solid-babylon/SceneCanvas'

import { Bullets } from './Bullets'
import { Cells } from './Cells'
import { Collisions } from './Collisions'
import { Culling } from './Culling'
import { EndScreen } from './EndScreen'
import { GameContext } from './GameContext'
import { Globe } from './Globe'
import { KeyboardPlayer } from './KeyboardPlayer'
import { Lights } from './Lights'
import { CameraLighting } from './NewLights'
import { Players } from './Players'
import { Rocks } from './Rocks'
import { Score } from './Score'
import { ShipCamera } from './ShipCamera'
import { Ships } from './Ships'
import { StartScreen } from './StartScreen'
import { type GameActions, bindGameActions } from './store/game/GameActions'
import { type GameStore, createGameStore } from './store/game/GameStore'
import { UI } from './UI'

export const HexagonoidsCanvas: Component<
  JSX.CanvasHTMLAttributes<HTMLCanvasElement>
> = (props) => {
  const $game = createGameStore()
  const gameActions = bindGameActions($game)
  const gameContext: [$game: GameStore, actions: GameActions] = [
    $game,
    gameActions,
  ]

  const antialias = true
  const adaptToDeviceRatio = true

  const engineOptions: EngineOptions = {}
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
      {...props}>
      <GameContext.Provider value={gameContext}>
        <Show when={ready()}>
          <Globe>
            <Ships />
            <Players />
            <Bullets />
            <Rocks />
            <Cells />
            <Lights />
            <KeyboardPlayer>
              <ShipCamera>
                <CameraLighting />
                <Culling />
                <UI>
                  <Score />
                  <StartScreen />
                  <EndScreen />
                </UI>
                <Collisions />
              </ShipCamera>
            </KeyboardPlayer>
          </Globe>
        </Show>
      </GameContext.Provider>
    </SceneCanvas>
  )
}
