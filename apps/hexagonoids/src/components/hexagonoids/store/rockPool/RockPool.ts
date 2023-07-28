import QuickLRU from 'quick-lru'
import { createUniqueId } from 'solid-js'

import { ROCK_CACHE_SIZE } from '../../constants'
import { createRockStore, type RockStore, resetRock } from '../rock/RockStore'

export const rockPool = new QuickLRU<string, RockStore>({
  maxSize: ROCK_CACHE_SIZE,
  onEviction(key, $rock) {
    // console.log('evicting rock', key)
    disposeRock($rock)
  },
})

const getOldestRock = () => {
  const oldestEntry = rockPool.entriesAscending().next().value
  if (oldestEntry === undefined) {
    return undefined
  }
  return oldestEntry[1] as RockStore | undefined
}

/**
 * Retrieve a rock from the pool, or create a new one.
 * @param id
 * @returns
 */
export const getRockStore = () => {
  // get or create
  const $rock = getOldestRock() ?? createRockStore()

  const id = $rock.get().id
  if (id === undefined) {
    throw new Error('Rock id must be set')
  }

  // remove from pool; give a new id
  if (rockPool.has(id)) {
    rockPool.delete(id)
    $rock.setKey('id', createUniqueId())
  }

  return $rock
}

/**
 * Release a rock back into the pool.
 * @param $rock
 */
export const releaseRockStore = ($rock: RockStore) => {
  const { id } = $rock.get()

  if (id === undefined) {
    throw new Error('Rock id must be set')
  }

  rockPool.set(id, resetRock($rock))
}

/**
 * Dispose of a rock.
 * @param $rock the rock to dispose
 */
export const disposeRock = ($rock: RockStore) => {
  const { originNode, orientationNode, rockNode } = $rock.get()

  // inside out
  rockNode?.material?.dispose(true, true)
  rockNode?.dispose(false, true)
  orientationNode?.dispose()
  originNode?.dispose()
}
