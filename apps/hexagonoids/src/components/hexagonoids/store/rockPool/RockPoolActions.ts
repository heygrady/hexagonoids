import type { Scene } from '@babylonjs/core'
import { action } from 'nanostores'
import type { OmitFirstArg } from 'nanostores/action'

import { generateRock as _generateRock } from '../../rock/generateRock'
import { splitRock as _splitRock } from '../../rock/splitRock'
import type { BulletStore } from '../bullet/BulletStore'
import type { RockState } from '../rock/RockState'
import type { RockStore } from '../rock/RockStore'

import { getRockStore } from './RockPool'
import { addRock, removeRock } from './RockPoolSetters'
import type { RockPoolStore } from './RockPoolStore'

export interface RockPoolActions {
  generateRock: OmitFirstArg<typeof generateRock>
  splitRock: OmitFirstArg<typeof splitRock>
  collideWithBullet: OmitFirstArg<typeof collideWithBullet>
}

export const bindRockPoolActions = (
  $rocks: RockPoolStore
): RockPoolActions => ({
  generateRock: action($rocks, 'generateRock', generateRock),
  splitRock: action($rocks, 'splitRock', splitRock),
  // FIXME: do we ever want collideWithShip or collideWithRock?
  collideWithBullet: action($rocks, 'collideWithBullet', collideWithBullet),
})

export type GenerateRockOptions = Partial<
  Omit<RockState, 'id' | 'originNode' | 'orientationNode' | 'rockNode'>
>

/**
 * Get a rock from the pool; prep it; add it to the scene
 * @param $rocks set of active rocks
 * @param scene the scene to generate the rock in
 * @param options
 * @returns the rock that was generated
 */
export const generateRock = (
  $rocks: RockPoolStore,
  scene: Scene,
  options?: GenerateRockOptions
) => {
  // Get a clean rock from the pool
  const $rock = getRockStore()

  // initialize the rock
  if (options != null) {
    for (const [key, value] of Object.entries(options)) {
      if (value != null) {
        $rock.setKey(key as keyof GenerateRockOptions, value)
      }
    }
  }

  // Initialize the rock
  _generateRock(scene, $rock)

  // Add the rock to the active rocks
  addRock($rocks, $rock)
  return $rock
}

/**
 * Splits a rock into two smaller rocks
 * @param $rocks set of active rocks
 * @param $rock the rock to split
 * @returns the rock that was split
 */
export const splitRock = (
  $rocks: RockPoolStore,
  $rock: RockStore
): RockStore[] => {
  const rockState = $rock.get()
  const { rockNode, originNode, orientationNode } = rockState

  if (rockNode == null || orientationNode == null || originNode == null) {
    throw new Error('Rock originNode, orientationNode and rockNode must be set')
  }

  // FIXME: is this the only reason we need rockNode?
  const scene = rockNode.getScene()

  const newRocks = _splitRock(scene, $rock)

  // remove the original rock from the scene
  removeRock($rocks, $rock)

  // add the new rocks to the scene
  for (const $rock of newRocks) {
    addRock($rocks, $rock)
  }
  return newRocks
}

export const collideWithBullet = (
  $rocks: RockPoolStore,
  $rock: RockStore,
  $bullet: BulletStore
): RockStore[] => {
  const rockState = $rock.get()
  const { size } = rockState

  if (size === 0) {
    removeRock($rocks, $rock)
    return []
  } else {
    return splitRock($rocks, $rock)
  }
}
