import type { Component, JSX } from 'solid-js'
import {
  createRenderEffect,
  onCleanup,
  createContext,
  useContext,
} from 'solid-js'

import { useSceneStore } from '../solid-babylon/hooks/useScene'

import { useGame } from './hooks/useGame'
import { usePlayerPool } from './hooks/usePlayerPool'
import { bindControlActions } from './store/control/ControlActions'
import type { GameStore } from './store/game/GameStore'
import {
  bindPlayerActions,
  type PlayerActions,
} from './store/player/PlayerActions'
import type { PlayerStore } from './store/player/PlayerStore'

export type PlayerContextValue = [$player: PlayerStore, actions: PlayerActions]
export const PlayerContext = createContext<PlayerContextValue>()
export const usePlayer = () => {
  const context = useContext(PlayerContext)
  if (context == null) {
    throw new Error('useGame: cannot find a PlayerContext.Provider')
  }
  return context
}

export interface KeyboardPlayerProps {
  children?: JSX.Element
}

const getControlActions = ($game: GameStore) => {
  const { $player } = $game.get()

  if ($player == null) {
    console.warn('no player found')
    return null
  }

  const { $ship } = $player.get()

  if ($ship == null) {
    console.warn('no ship found')
    return null
  }

  const $control = $ship.get().$control

  if ($control == null) {
    console.warn('no control found')
    return null
  }

  return bindControlActions($control)
}

// FIXME: Should we create a player context? We want to be able to move the camera to the active player
export const KeyboardPlayer: Component<KeyboardPlayerProps> = (props) => {
  const [$game] = useGame()
  const [$scene] = useSceneStore()
  const [, { generatePlayer }] = usePlayerPool()

  const createPlayer = () => {
    const scene = $scene.get().scene

    if (scene == null) {
      console.warn('no scene')
      return
    }

    // FIXME: where is the right place to create the player?
    const $player = generatePlayer()
    $game.setKey('$player', $player)
    return $player
  }

  const $player = createPlayer()
  if ($player == null) {
    throw new Error('no scene; no player')
  }

  const playerContext: PlayerContextValue = [
    $player,
    bindPlayerActions($player),
  ]

  createRenderEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const isRunning = $scene.get().running
      if (isRunning) {
        event.preventDefault()
      } else {
        return
      }
      const isAlive = $game.get().$player?.get().alive ?? false
      if (!isAlive) {
        return
      }

      const controlActions = getControlActions($game)
      if (controlActions == null) {
        // console.warn('no control actions found')
        return
      }
      const { leftDown, rightDown, accelerateDown, fireDown } = controlActions
      if (event.key === 'a' || event.key === 'A' || event.key === 'ArrowLeft') {
        leftDown()
      }
      if (
        event.key === 'd' ||
        event.key === 'D' ||
        event.key === 'ArrowRight'
      ) {
        rightDown()
      }
      if (event.key === 'w' || event.key === 'W' || event.key === 'ArrowUp') {
        accelerateDown()
      }
      if (
        event.key === 's' ||
        event.key === 'S' ||
        event.key === 'ArrowDown' ||
        event.key === ' ' ||
        event.key === 'Space'
      ) {
        fireDown()
      }
    }

    const handleKeyUp = (event: KeyboardEvent) => {
      const isRunning = $scene.get().running
      const isAlive = $game.get().$player?.get().alive ?? false
      if (!isAlive || !isRunning) {
        return
      }

      const controlActions = getControlActions($game)
      if (controlActions == null) {
        // console.warn('no control actions found')
        return
      }
      const { leftUp, rightUp, accelerateUp, fireUp } = controlActions
      if (event.key === 'a' || event.key === 'A' || event.key === 'ArrowLeft') {
        leftUp()
      }
      if (
        event.key === 'd' ||
        event.key === 'D' ||
        event.key === 'ArrowRight'
      ) {
        rightUp()
      }
      if (event.key === 'w' || event.key === 'W' || event.key === 'ArrowUp') {
        accelerateUp()
      }
      if (
        event.key === 's' ||
        event.key === 'S' ||
        event.key === 'ArrowDown' ||
        event.key === ' ' ||
        event.key === 'Space'
      ) {
        fireUp()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)

    onCleanup(() => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    })
  })

  return (
    <PlayerContext.Provider value={playerContext}>
      {props.children}
    </PlayerContext.Provider>
  )
}
