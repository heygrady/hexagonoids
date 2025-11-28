import { Quaternion } from '@babylonjs/core/Maths/math.vector'
import { vector3ToLatLng } from '@heygrady/h3-babylon'
import type { Component } from 'solid-js'
import { unwrap } from 'solid-js/store'

import { onBeforeRender } from '../solid-babylon/hooks/onBeforeRender'
import { useScene } from '../solid-babylon/hooks/useScene'

import { MAX_DELTA, ROCK_LARGE_SPEED, ROCK_SMALL_SPEED } from './constants'
import { integrateAngularVelocity } from './ship/quaternionPhysics'
import { setCells, setLocation } from './store/rock/RockSetters'
import type { RockStore } from './store/rock/RockStore'

export interface RockProps {
  id?: string
  store: RockStore
}

export const Rock: Component<RockProps> = (props) => {
  const scene = useScene()

  const $rock = unwrap(props.store)

  // Require id, originNode and rockNode
  const rockState = $rock.get()
  const { id, originNode, rockNode } = rockState

  if (id === undefined) {
    throw new Error('Cannot render a rock without a RockState.id')
  }
  if (originNode == null) {
    throw new Error('Cannot render a rock without a RockState.originNode')
  }
  if (rockNode == null) {
    throw new Error('Cannot render a rock without a RockState.rockNode')
  }

  // Rock material color is now handled globally by CameraLighting component
  // based on camera position, not individual rock positions

  const moveRock = () => {
    const rockState = $rock.get()
    const { rockNode, originNode } = rockState

    if (originNode == null) {
      console.error('Cannot render a rock without a RockState.originNode')
      return
    }
    if (rockNode == null) {
      console.error('Cannot render a rock without a RockState.rockNode')
      return
    }

    // Move the rock using quaternion physics
    if (rockState.angularVelocity.length() > 0) {
      const delta = Math.min(MAX_DELTA, scene.getEngine().getDeltaTime())

      // Ensure rotationQuaternion is initialized
      if (originNode.rotationQuaternion == null) {
        originNode.rotationQuaternion = Quaternion.Identity()
      }

      // Clamp velocity to rock speed range (safety check)
      // ROCK_LARGE_SPEED is the minimum (slowest rocks), ROCK_SMALL_SPEED is maximum (fastest rocks)
      const speed = rockState.angularVelocity.length()
      const clampedSpeed = Math.max(
        ROCK_LARGE_SPEED,
        Math.min(speed, ROCK_SMALL_SPEED)
      )
      const clampedVelocity =
        speed > 0.00001
          ? rockState.angularVelocity.scale(clampedSpeed / speed)
          : rockState.angularVelocity

      // Integrate angular velocity over deltaTime
      const updatedRotation = integrateAngularVelocity(
        originNode.rotationQuaternion,
        clampedVelocity,
        delta / 1000 // Convert milliseconds to seconds
      )

      // Update origin node position quaternion
      originNode.rotationQuaternion = updatedRotation

      // Force world matrix recalculation
      originNode.computeWorldMatrix(true)

      // Get new location from the mesh's position in the scene
      setLocation($rock, vector3ToLatLng(rockNode.absolutePosition))
      setCells($rock)
    }
  }
  onBeforeRender(moveRock)

  // // Debug hexagon
  // onBeforeRender(() => {
  //   const rockState = $rock.get()

  //   // pick a fixed radius for each type of object
  //   const radius =
  //     $rock.get().size === ROCK_LARGE_SIZE
  //       ? ROCK_LARGE_RADIUS
  //       : $rock.get().size === ROCK_MEDIUM_SIZE
  //       ? ROCK_MEDIUM_RADIUS
  //       : ROCK_SMALL_RADIUS

  //   const hexagon = createHexagon(radius)
  //   generateHexagonDebugNodes(
  //     scene,
  //     rockState.id ?? 'unknown',
  //     hexagon,
  //     geoToVector3(rockState.lat, rockState.lng, RADIUS)
  //   )
  // })
  return null
}
