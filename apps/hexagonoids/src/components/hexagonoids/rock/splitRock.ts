import type { Scene } from '@babylonjs/core'

import {
  ROCK_LARGE_SIZE,
  ROCK_MEDIUM_SIZE,
  ROCK_SMALL_SIZE,
} from '../constants'
import type { RockStore } from '../store/rock/RockStore'
import { getRockStore } from '../store/rockPool/RockPool'

import { generateRock } from './generateRock'
import { orientToRock } from './orientToRock'

/**
 * Generates two new rocks from the given rock. Does not alter the given rock.
 * @param scene
 * @param $rock the rock to split
 * @returns the new rock
 */
export const splitRock = (scene: Scene, $rock: RockStore): RockStore[] => {
  const { id, size, originNode, orientationNode, rockNode } = $rock.get()

  if (originNode == null || orientationNode == null || rockNode == null) {
    throw new Error('Rock originNode, orientationNode and rockNode must be set')
  }

  if (id === undefined) {
    throw new Error('Rock id must be set')
  }

  if (size === ROCK_SMALL_SIZE) {
    throw new Error('Cannot split a rock with size ROCK_SMALL_SIZE')
  }

  // 1. create two new rocks
  const $rock1 = getRockStore()
  const $rock2 = getRockStore()

  // 2. size them appropriately
  if (size === ROCK_LARGE_SIZE) {
    $rock1.setKey('size', ROCK_MEDIUM_SIZE)
    $rock2.setKey('size', ROCK_MEDIUM_SIZE)
  } else if (size === ROCK_MEDIUM_SIZE) {
    $rock1.setKey('size', ROCK_SMALL_SIZE)
    $rock2.setKey('size', ROCK_SMALL_SIZE)
  }

  // 2. initialize nodes and state (speed is set here)
  generateRock(scene, $rock1)
  generateRock(scene, $rock2)

  // 3. orient them to the original rock
  const side = Math.random() < 0.5 ? -1 : 1
  orientToRock($rock1, $rock, side)
  orientToRock($rock2, $rock, -side)

  return [$rock1, $rock2]
}
