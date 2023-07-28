import type { Component, JSX } from 'solid-js'
import { For } from 'solid-js'

import { subscribeRockPool } from './hooks/useRockPool'
import { Rock } from './Rock'

export interface RocksProps {
  children?: JSX.Element
}

export const Rocks: Component<RocksProps> = (props) => {
  const rocks = subscribeRockPool()

  return (
    <>
      <For each={Object.keys(rocks())}>
        {(id) => {
          const $rock = rocks()[id]
          if ($rock == null) {
            return
          }
          return <Rock id={id} store={$rock} />
        }}
      </For>
      {props.children}
    </>
  )
}
