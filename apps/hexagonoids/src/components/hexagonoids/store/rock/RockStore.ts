import { Quaternion } from '@babylonjs/core'
import { type MapStore, map } from 'nanostores'
import { createUniqueId } from 'solid-js'

import { type RockState, defaultRockState } from './RockState'

export type RockStore = MapStore<RockState>

/**
 * This is used by the RockPool to create rocks.
 * @returns
 */
export const createRockStore = (): RockStore => {
  const $rock = map<RockState>({ ...defaultRockState })
  $rock.setKey('id', createUniqueId())
  return $rock
}

/**
 * This is used by the RockPool to recycle rocks.
 * @param $rock
 * @returns
 */
export const resetRock = ($rock: RockStore) => {
  const { id, originNode, orientationNode, rockNode } = $rock.get()

  // make it invisible
  if (originNode != null && rockNode != null) {
    rockNode.isVisible = false
    originNode.setEnabled(false)
  }

  // reset the quaternions
  if (originNode != null) {
    originNode.rotationQuaternion = Quaternion.Identity()
  }
  if (orientationNode != null) {
    orientationNode.rotationQuaternion = Quaternion.Identity()
  }

  $rock.set({ ...defaultRockState, id, originNode, orientationNode, rockNode })
  return $rock
}
