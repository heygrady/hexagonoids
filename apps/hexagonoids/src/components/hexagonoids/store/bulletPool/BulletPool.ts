import QuickLRU from 'quick-lru'
import { createUniqueId } from 'solid-js'

import { BULLET_CACHE_SIZE } from '../../constants'
import {
  createBulletStore,
  type BulletStore,
  resetBullet,
} from '../bullet/BulletStore'

export const bulletPool = new QuickLRU<string, BulletStore>({
  maxSize: BULLET_CACHE_SIZE,
  onEviction(key, $bullet) {
    // console.log('evicting bullet', key)
    disposeBullet($bullet)
  },
})

const getOldestBullet = () => {
  const oldestEntry = bulletPool.entriesAscending().next().value
  if (oldestEntry === undefined) {
    return undefined
  }
  return oldestEntry[1] as BulletStore | undefined
}

/**
 * Retrieve a bullet from the pool, or create a new one.
 * @param id
 * @returns
 */
export const getBulletStore = () => {
  // get or create
  const $bullet = getOldestBullet() ?? createBulletStore()

  const id = $bullet.get().id
  if (id === undefined) {
    throw new Error('Bullet id must be set')
  }

  // remove from pool; give a new id
  if (bulletPool.has(id)) {
    bulletPool.delete(id)
    $bullet.setKey('id', createUniqueId())
  }

  return $bullet
}

/**
 * Release a bullet back into the pool.
 * @param $bullet
 */
export const releaseBulletStore = ($bullet: BulletStore) => {
  const { id } = $bullet.get()

  if (id === undefined) {
    throw new Error('Bullet id must be set')
  }

  bulletPool.set(id, resetBullet($bullet))
}

/**
 * Dispose of a bullet.
 * @param $bullet the bullet to dispose
 */
export const disposeBullet = ($bullet: BulletStore) => {
  const { originNode, bulletNode } = $bullet.get()

  // inside out
  bulletNode?.material?.dispose(true, true)
  bulletNode?.dispose(false, true)
  originNode?.dispose()
}
