import type { Component, JSX } from 'solid-js'
import { For, onCleanup } from 'solid-js'

import { subscribePlayerPool } from './hooks/usePlayerPool'
import { Player } from './Player'

export interface PlayersProps {
  children?: JSX.Element
}

export const Players: Component<PlayersProps> = (props) => {
  const players = subscribePlayerPool()

  onCleanup(() => {})

  return (
    <>
      <For each={Object.keys(players())}>
        {(id) => {
          const $player = players()[id]
          if ($player == null) {
            return
          }
          return <Player id={id} store={$player} />
        }}
      </For>
      {props.children}
    </>
  )
}
