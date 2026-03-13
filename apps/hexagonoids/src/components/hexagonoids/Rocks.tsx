import { useGameState } from '@heygrady/hexagonoids-engine/solid'
import type { Component, JSX } from 'solid-js'
import { For } from 'solid-js'

import { useScene } from '../solid-babylon/hooks/useScene'

import { createRockNodePool } from './engine/rockNodePool'
import { Rock } from './Rock'

export interface RocksProps {
  children?: JSX.Element
}

export const Rocks: Component<RocksProps> = (props) => {
  const engine = useGameState()
  const scene = useScene()
  const globe = scene.getMeshByName('globe')
  const pool = createRockNodePool(scene, globe)

  return (
    <>
      <For each={engine.rockIds()}>
        {(id) => <Rock rockId={id} pool={pool} />}
      </For>
      {props.children}
    </>
  )
}
