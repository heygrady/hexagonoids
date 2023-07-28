import { Quaternion, type Scene } from '@babylonjs/core'
import { easeCubicIn, easeCubicInOut, easeCubicOut } from 'd3-ease'

import {
  RADIUS,
  ROCK_LARGE_SCALE,
  ROCK_LARGE_SIZE,
  ROCK_LARGE_SPEED,
  ROCK_LARGE_VALUE,
  ROCK_MEDIUM_SCALE,
  ROCK_MEDIUM_SIZE,
  ROCK_MEDIUM_VALUE,
  ROCK_SMALL_SCALE,
  ROCK_SMALL_SIZE,
  ROCK_SMALL_SPEED,
  ROCK_SMALL_VALUE,
} from '../constants'
import { geoToVector3, vector3ToGeo } from '../geoCoords/geoToVector3'
import { getYawPitch } from '../ship/getYawPitch'
import { getOrientation, moveNodeTo, turnNodeBy } from '../ship/orientation'
import { setHeading, setLocation, setYaw } from '../store/rock/RockSetters'
import type { RockStore } from '../store/rock/RockStore'

import { createRockNodes } from './createRockNodes'

/*
 * Updates rock state and rock nodes.
 * @param scene
 * @param $rock the rock to generate
 * @param splitting
 */
export const generateRock = (scene: Scene, $rock: RockStore) => {
  let { originNode, orientationNode, rockNode } = $rock.get()

  /**
   * 1. Create the rock nodes if they don't exist
   * 2. Set value and speed
   * 3. Position the rock
   * 4. Set the rock heading
   * 5. Rotate the rock
   * 6. Update from scene
   */

  // 1. Create the rock nodes if they don't exist
  if (originNode == null || orientationNode == null || rockNode == null) {
    ;({ originNode, orientationNode, rockNode } = createRockNodes(
      scene,
      $rock.get().id ?? 'unknown'
    ))
    $rock.setKey('rockNode', rockNode)
    $rock.setKey('orientationNode', orientationNode)
    $rock.setKey('originNode', originNode)
    rockNode.onDisposeObservable.addOnce(() => {
      $rock.setKey('rockNode', null)
    })
    orientationNode.onDisposeObservable.addOnce(() => {
      $rock.setKey('orientationNode', null)
    })
    originNode.onDisposeObservable.addOnce(() => {
      $rock.setKey('originNode', null)
    })
  }

  // make sure the nodes are visible
  rockNode.isVisible = true
  originNode.setEnabled(true)

  const rockState = $rock.get()

  // 2. Set scale, value and speed
  const minSpeed = ROCK_LARGE_SPEED
  const maxSpeed = ROCK_SMALL_SPEED
  const range = maxSpeed - minSpeed
  if (rockState.size === ROCK_LARGE_SIZE) {
    rockNode.scaling.setAll(ROCK_LARGE_SCALE)
    $rock.setKey('value', ROCK_LARGE_VALUE)
    const t = easeCubicIn(Math.random())
    $rock.setKey('speed', minSpeed + range * t)
  } else if (rockState.size === ROCK_MEDIUM_SIZE) {
    rockNode.scaling.setAll(ROCK_MEDIUM_SCALE)
    $rock.setKey('value', ROCK_MEDIUM_VALUE)
    const t = easeCubicInOut(Math.random())
    $rock.setKey('speed', minSpeed + range * t)
  } else if (rockState.size === ROCK_SMALL_SIZE) {
    rockNode.scaling.setAll(ROCK_SMALL_SCALE)
    $rock.setKey('value', ROCK_SMALL_VALUE)
    const t = easeCubicOut(Math.random())
    $rock.setKey('speed', minSpeed + range * t)
  }

  // 3. Position the rock
  const position = geoToVector3(rockState.lat, rockState.lng, RADIUS)
  const [yaw, pitch] = getYawPitch(position)
  moveNodeTo(originNode, yaw, pitch)

  // 4. Set the rock heading
  if (rockState.heading !== 0) {
    const [rockHeading] = getOrientation(originNode)

    if (originNode.rotationQuaternion == null) {
      originNode.rotationQuaternion = Quaternion.Identity()
    }

    const diffHeading = rockState.heading - rockHeading
    originNode.rotationQuaternion = originNode.rotationQuaternion.multiply(
      Quaternion.RotationYawPitchRoll(diffHeading, 0, 0)
    )
  }

  // 4. Rotate the rock
  if (rockState.yaw !== 0) {
    const rockYaw = getOrientation(orientationNode)[0]
    turnNodeBy(orientationNode, rockState.yaw - rockYaw)
  }

  // 5. Update from scene
  setHeading($rock, getOrientation(originNode)[0])
  setLocation($rock, vector3ToGeo(rockNode.absolutePosition))
  setYaw($rock, getOrientation(orientationNode)[0])
}
