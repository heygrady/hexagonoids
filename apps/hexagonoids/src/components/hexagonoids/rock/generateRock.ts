import { Vector3 } from '@babylonjs/core/Maths/math.vector'
import type { Scene } from '@babylonjs/core/scene'
import { latLngToVector3, vector3ToLatLng } from '@heygrady/h3-babylon'
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
import { getYawPitch } from '../ship/getYawPitch'
import { getOrientation, moveNodeTo, turnNodeBy } from '../ship/orientation'
import { headingToAngularVelocity } from '../ship/quaternionPhysics'
import { setLocation, setYaw } from '../store/rock/RockSetters'
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

  // 2. Set scale, value and angular velocity
  const minSpeed = ROCK_LARGE_SPEED
  const maxSpeed = ROCK_SMALL_SPEED
  const range = maxSpeed - minSpeed
  let speed = 0
  if (rockState.size === ROCK_LARGE_SIZE) {
    rockNode.scaling.setAll(ROCK_LARGE_SCALE)
    $rock.setKey('value', ROCK_LARGE_VALUE)
    const t = easeCubicIn(Math.random())
    speed = minSpeed + range * t
  } else if (rockState.size === ROCK_MEDIUM_SIZE) {
    rockNode.scaling.setAll(ROCK_MEDIUM_SCALE)
    $rock.setKey('value', ROCK_MEDIUM_VALUE)
    const t = easeCubicInOut(Math.random())
    speed = minSpeed + range * t
  } else if (rockState.size === ROCK_SMALL_SIZE) {
    rockNode.scaling.setAll(ROCK_SMALL_SCALE)
    $rock.setKey('value', ROCK_SMALL_VALUE)
    const t = easeCubicOut(Math.random())
    speed = minSpeed + range * t
  }

  // 3. Position the rock
  const position = latLngToVector3(rockState.lat, rockState.lng, RADIUS)
  const [yaw, pitch] = getYawPitch(position)
  moveNodeTo(originNode, yaw, pitch)

  // Initialize angular velocity with random direction and computed speed magnitude
  // This must happen AFTER positioning so the quaternion is set
  if (speed > 0 && originNode.rotationQuaternion != null) {
    const randomHeading = Math.random() * Math.PI * 2
    const angularVelocity = headingToAngularVelocity(
      originNode.rotationQuaternion,
      randomHeading,
      speed
    )
    $rock.setKey('angularVelocity', angularVelocity)
  } else if (speed === 0) {
    $rock.setKey('angularVelocity', Vector3.Zero())
  }

  // Note: Heading is now determined by angular velocity direction

  // 4. Rotate the rock
  if (rockState.yaw !== 0) {
    const rockYaw = getOrientation(orientationNode)[0]
    turnNodeBy(orientationNode, rockState.yaw - rockYaw)
  }

  // 5. Update from scene
  setLocation($rock, vector3ToLatLng(rockNode.absolutePosition))
  setYaw($rock, getOrientation(orientationNode)[0])
}
