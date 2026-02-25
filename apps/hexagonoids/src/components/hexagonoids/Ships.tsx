import { useGameState } from '@heygrady/hexagonoids-engine/solid'
import type { Component, JSX } from 'solid-js'
import { For } from 'solid-js'

import { useScene } from '../solid-babylon/hooks/useScene'

import { createShipNodePool } from './engine/shipNodePool'
import { Ship } from './Ship'

export interface ShipsProps {
  children?: JSX.Element
}

export const Ships: Component<ShipsProps> = (props) => {
  const engine = useGameState()
  const scene = useScene()
  const globe = scene.getMeshByName('globe')
  const pool = createShipNodePool(scene, globe)

  return (
    <>
      <For each={engine.shipIds()}>
        {(id) => <Ship shipId={id} pool={pool} />}
      </For>
      {props.children}
    </>
  )
}
