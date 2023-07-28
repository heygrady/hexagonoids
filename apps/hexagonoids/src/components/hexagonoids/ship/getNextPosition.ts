import type { TransformNode } from '@babylonjs/core'

import { RADIUS } from '../constants'

import { getNextPoint } from './getNextPoint'

export const getNextPosition = (
  node: TransformNode,
  heading: number,
  distance: number,
  radius: number = RADIUS
) => {
  const nextPosition = getNextPoint(heading, distance).scaleInPlace(radius)
  node.getDirectionToRef(nextPosition, nextPosition)
  return nextPosition
}
