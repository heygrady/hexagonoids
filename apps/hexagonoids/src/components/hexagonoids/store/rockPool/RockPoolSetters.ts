import { action } from 'nanostores'
import type { OmitFirstArg } from 'nanostores/action'
import { unwrap } from 'solid-js/store'

import type { RockStore } from '../rock/RockStore'

import { releaseRockStore } from './RockPool'
import type { RockPoolStore } from './RockPoolStore'

interface RockPoolSetters {
  add: OmitFirstArg<typeof addRock>
  remove: OmitFirstArg<typeof removeRock>
  clear: OmitFirstArg<typeof clearRocks>
}

export const bindRockPoolSetters = (
  $rockPool: RockPoolStore
): RockPoolSetters => ({
  add: action($rockPool, 'add', addRock),
  remove: action($rockPool, 'remove', removeRock),
  clear: action($rockPool, 'clear', clearRocks),
})

export const addRock = ($rocks: RockPoolStore, $rock: RockStore) => {
  const id = $rock.get().id

  if (id === undefined) {
    console.warn('Cannot add rock without an id')
    return
  }

  const $prevRock = $rocks.get()[id]

  if ($rock !== $prevRock) {
    $rocks.setKey(id, $rock)
  }
}

export const removeRock = ($rocks: RockPoolStore, $rock: RockStore) => {
  const id = $rock.get().id

  if (id === undefined) {
    throw new Error('Cannot remove rock without an id')
  }

  // remove from active rocks
  $rocks.setKey(id, undefined)

  // release back into the pool
  releaseRockStore(unwrap($rock))
}

export const clearRocks = ($rocks: RockPoolStore) => {
  for (const $rock of Object.values($rocks.get())) {
    if ($rock == null) {
      continue
    }
    removeRock($rocks, $rock)
  }
}
