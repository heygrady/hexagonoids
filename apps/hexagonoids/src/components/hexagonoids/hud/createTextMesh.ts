import {
  type Scene,
  type TransformNode,
  MeshBuilder,
  type Mesh,
  Quaternion,
  type AbstractMesh,
} from '@babylonjs/core'
import earcut from 'earcut'

import { getCommonMaterial } from '../common/commonMaterial'

import fontData from './AsteroidsFont.json'

export const createTextMesh = (scene: Scene, string: string) => {
  const textNode = MeshBuilder.CreateText(
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

  // right justify the text
  if (justify === 'left' || justify === 'right') {
    const textWidth = textNode.getBoundingInfo().boundingBox.extendSize.x * 2
    // FIXME: this calculation is weird. Trying to specify is the left or right edge of the text is touching the origin
    textNode.position.x = -(textWidth / 2) * (justify === 'right' ? -1 : 1)
  }
}
