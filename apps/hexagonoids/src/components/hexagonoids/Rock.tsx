import { Color3 } from '@babylonjs/core'
import { cellToLatLng, latLngToCell } from 'h3-js'
import type { Component } from 'solid-js'
import { unwrap } from 'solid-js/store'

import { onBeforeRender } from '../solid-babylon/hooks/onBeforeRender'
import { useScene } from '../solid-babylon/hooks/useScene'

import { ROCK_SMALL_SPEED, ROCK_LARGE_SPEED, MAX_DELTA } from './constants'
import { vector3ToGeo } from './geoCoords/geoToVector3'
import { blendColors } from './NewLights'
import { pitchNodeBy } from './ship/orientation'
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

  // Handle rock material color
  let prevCell: string | null = null
  const changeRockColor = () => {
    const { lat, lng, rockNode } = $rock.get()

    const cell = latLngToCell(lat, lng, 2)
    if (cell === prevCell) {
      return
    }
    prevCell = cell
    const [cellLat] = cellToLatLng(cell)
    // convert north pole to 1, south pole to 0
    const blendFactor = (cellLat + 90) / 180

    const color = blendColors(Color3.Magenta(), Color3.Teal(), blendFactor)
    if (rockNode?.material != null) {
      // @ts-expect-error Material does not have diffuseColor
      rockNode.material.diffuseColor = color
    }
  }
  onBeforeRender(changeRockColor)

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

    // Move the rock
    if (rockState.speed > 0) {
      const speed = Math.max(
        ROCK_LARGE_SPEED,
        Math.min(rockState.speed, ROCK_SMALL_SPEED)
      )
      const delta = Math.min(MAX_DELTA, scene.getEngine().getDeltaTime())
      const distance = (speed / 1000) * delta

      // FIXME: should be larger than MIN_DISTANCE
      if (distance === 0) {
        return
      }

      // Pitch the rock forward by distance radians
      pitchNodeBy(originNode, distance)
      setLocation($rock, vector3ToGeo(rockNode.absolutePosition))
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
