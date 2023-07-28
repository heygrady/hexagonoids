import type { Component, JSX } from 'solid-js'
import { For } from 'solid-js'

import { subscribeShipPool } from './hooks/useShipPool'
import { Ship } from './Ship'

export interface ShipsProps {
  children?: JSX.Element
}

export const Ships: Component<ShipsProps> = (props) => {
  const ships = subscribeShipPool()

  return (
    <>
      <For each={Object.keys(ships())}>
        {(id) => {
          const $ship = ships()[id]
          if ($ship == null) {
            return
          }
          return <Ship id={id} store={$ship} />
        }}
      </For>
      {props.children}
    </>
  )
}
