import type { Component } from 'solid-js'
import { For, onCleanup } from 'solid-js'

import { Bullet } from './Bullet'
import { subscribeBulletPool } from './hooks/useBulletPool'

export const Bullets: Component = () => {
  const bullets = subscribeBulletPool()

  onCleanup(() => {
    // destroyAllBullets($bullets)
  })

  return (
    <For each={Object.keys(bullets())}>
      {(id) => {
        const $bullet = bullets()[id]
        if ($bullet == null) {
          return
        }
        return <Bullet id={id} store={$bullet} />
      }}
    </For>
  )
}
