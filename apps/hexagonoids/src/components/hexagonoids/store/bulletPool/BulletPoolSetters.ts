import { action } from 'nanostores'
import type { OmitFirstArg } from 'nanostores/action'

import type { BulletStore } from '../bullet/BulletStore'

import { releaseBulletStore } from './BulletPool'
import type { BulletPoolStore } from './BulletPoolStore'

interface BulletPoolSetters {
  add: OmitFirstArg<typeof addBullet>
  remove: OmitFirstArg<typeof removeBullet>
  clear: OmitFirstArg<typeof clearBullets>
}

export const bindBulletPoolSetters = (
  $bulletPool: BulletPoolStore
): BulletPoolSetters => ({
  add: action($bulletPool, 'add', addBullet),
  remove: action($bulletPool, 'remove', removeBullet),
  clear: action($bulletPool, 'clear', clearBullets),
})

export const addBullet = ($bullets: BulletPoolStore, $bullet: BulletStore) => {
  const id = $bullet.get().id

  if (id === undefined) {
    console.warn('Cannot add bullet without an id')
    return
  }

  const $prevBullet = $bullets.get()[id]

  if ($bullet === $prevBullet) {
    return
  }

  $bullets.setKey(id, $bullet)
}

export const removeBullet = (
  $bullets: BulletPoolStore,
  $bullet: BulletStore
) => {
  const id = $bullet.get().id

  if (id === undefined) {
    throw new Error('Cannot remove bullet without an id')
  }

  // remove from the scene
  $bullets.setKey(id, undefined)

  // release back into the pool
  releaseBulletStore($bullet)
}

export const clearBullets = ($bullets: BulletPoolStore) => {
  for (const $bullet of Object.values($bullets.get())) {
    if ($bullet == null) {
      continue
    }
    removeBullet($bullets, $bullet)
  }
}
