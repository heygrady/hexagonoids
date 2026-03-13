import { useGameState } from '@heygrady/hexagonoids-engine/solid'
import type { Component, JSX } from 'solid-js'
import { For } from 'solid-js'

import { useScene } from '../solid-babylon/hooks/useScene'

import { Bullet } from './Bullet'
import { createBulletNodePool } from './engine/bulletNodePool'

export interface BulletsProps {
  children?: JSX.Element
}

export const Bullets: Component<BulletsProps> = (props) => {
  const engine = useGameState()
  const scene = useScene()
  const globe = scene.getMeshByName('globe')
  const pool = createBulletNodePool(scene, globe)

  return (
    <>
      <For each={engine.bulletIds()}>
        {(id) => <Bullet bulletId={id} pool={pool} />}
      </For>
      {props.children}
    </>
  )
}
