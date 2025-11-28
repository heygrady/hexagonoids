import { Quaternion } from '@babylonjs/core/Maths/math.vector'
import { CreateText } from '@babylonjs/core/Meshes/Builders/textBuilder'
import type {
  Scene,
  TransformNode,
  Mesh,
  AbstractMesh,
} from '@babylonjs/core/scene'
import earcut from 'earcut'

import { getCommonMaterial } from '../common/commonMaterial'

import fontData from './AsteroidsFont.json'

export const createTextMesh = (scene: Scene, string: string) => {
  const textNode = CreateText(
    `text_${string}`,
    String(string),
    fontData,
    {
      size: 1,
      resolution: 8,
      depth: 0.001,
    },
    scene,
    earcut
  ) as Mesh

  // fix the rotation (why is it so wrong?)
  if (textNode.rotationQuaternion == null) {
    textNode.rotationQuaternion = Quaternion.Identity()
  }

  textNode.rotationQuaternion = textNode.rotationQuaternion.multiply(
    Quaternion.RotationYawPitchRoll(0, -Math.PI * 0.5, 0)
  )

  textNode.rotationQuaternion = textNode.rotationQuaternion.multiply(
    Quaternion.RotationYawPitchRoll(-Math.PI, 0, 0)
  )

  textNode.material = getCommonMaterial(scene)

  return textNode
}

export const updateText = (
  originNode: TransformNode,
  string: string,
  justify: 'right' | 'left' | 'center' = 'center'
) => {
  const scene = originNode.getScene()
  const textNode = createTextMesh(scene, string)
  replaceText(originNode, textNode, justify)
}

export const replaceText = (
  originNode: TransformNode,
  textNode: AbstractMesh,
  justify: 'right' | 'left' | 'center' = 'center'
) => {
  // dispose of the old origin node children
  originNode.getChildMeshes().forEach((n) => {
    n.dispose(false, true)
  })

  textNode.parent = originNode

  // Align text left or right relative to the origin node
  if (justify === 'left' || justify === 'right') {
    const textWidth = textNode.getBoundingInfo().boundingBox.extendSize.x * 2

    // Math explanation:
    // The text's bounding box center is at the origin. We want to move it so that either
    // its left or right edge touches the origin.
    // - textWidth / 2 moves from center to the edge
    // - The ternary inverts the sign: 'right' uses -1 (negative = left offset),
    //   'left' uses 1 (positive = right offset), positioning the opposite edge at origin
    // Example: For 'right' justify, we want the right edge at origin, so we move left (negative)
    textNode.position.x = -(textWidth / 2) * (justify === 'right' ? -1 : 1)
  }
}
