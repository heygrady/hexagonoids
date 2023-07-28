import { Vector3, Matrix, type TransformNode } from '@babylonjs/core'
import { easeQuadIn } from 'd3-ease'

import {
  CAMERA_RADIUS,
  MAX_DURATION,
  MAX_SPEED,
  SCREEN_EDGE_BUFFER,
} from '../constants'

import { getPitchRoll } from './getPitchRoll'
import { getYawPitch } from './getYawPitch'
import { moveNodeBy } from './orientation'

export const moveCamera = (
  shipPosition: TransformNode,
  delta: number,
  duration: number = MAX_DURATION
) => {
  const scene = shipPosition.getScene()
  const engine = scene.getEngine()
  const camera = scene.getCameraByName('shipCamera')
  const shipCameraOrigin = scene.getTransformNodeByName('shipCameraOrigin')
  const shipCameraPosition = scene.getTransformNodeByName('shipCameraPosition')

  if (
    camera == null ||
    shipCameraPosition == null ||
    shipCameraOrigin == null
  ) {
    console.warn('Warning:', { camera, shipCameraOrigin, shipCameraPosition })
    return
  }

  const screenWidth = engine.getRenderWidth(true)
  const screenHeight = engine.getRenderHeight(true)

  const shipScreenPosition = Vector3.Project(
    shipPosition.absolutePosition,
    Matrix.Identity(),
    scene.getTransformMatrix(),
    camera.viewport.toGlobal(screenWidth, screenHeight)
  )

  const screenEdgeMargin = screenHeight * SCREEN_EDGE_BUFFER
  const paddingY = 100
  const paddingX = 150

  const left = shipScreenPosition.x - paddingX
  const right = screenWidth - shipScreenPosition.x - paddingX
  const top = shipScreenPosition.y - paddingY
  const bottom = screenHeight - shipScreenPosition.y - paddingY

  const closest = Math.min(left, right, top, bottom)
  const isNearScreenEdge = closest < screenEdgeMargin
  const ratio = (screenEdgeMargin - closest) / screenEdgeMargin
  const et = easeQuadIn(Math.max(0, Math.min(1, ratio)))

  if (isNearScreenEdge && et !== 0) {
    // Find the ship in world position, scaled to the camera radius
    const position = shipPosition
      .getAbsolutePosition()
      .clone()
      .normalize()
      .scaleInPlace(CAMERA_RADIUS)

    // Invert the world matrix to get the local-to-world matrix
    const localToWorldMatrix = Matrix.Invert(
      shipCameraPosition.getWorldMatrix()
    )

    // Transform the point from world space to local space
    const localPosition = Vector3.TransformCoordinates(
      position,
      localToWorldMatrix
    ).addInPlace(Vector3.Up().scale(CAMERA_RADIUS))

    // Find a point MAX_SPEED away from the camera position towards the ship
    const [yaw] = getYawPitch(localPosition)
    const rotationMatrix = Matrix.RotationYawPitchRoll(
      yaw,
      ((MAX_SPEED * 1.25) / 1000) * delta,
      0
    )
    const target = Vector3.TransformCoordinates(Vector3.Up(), rotationMatrix)

    // Move the camera towards the target using only the pitch and roll (to keep the camera upright)
    const [pitch, roll] = getPitchRoll(target)
    moveNodeBy(shipCameraOrigin, 0, pitch * et, roll * et)
  }
}
