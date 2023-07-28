import { type Scene, TransformNode } from '@babylonjs/core'

import { createTextMesh, replaceText, updateText } from './createTextMesh'

const scoreJustify = 'left'

export const createScoreNodes = (
  scene: Scene,
  score: string = '0'
): TransformNode => {
  const originNode = new TransformNode('scoreOrigin')
  const textNode = createTextMesh(scene, score)

  replaceText(originNode, textNode, scoreJustify)

  return originNode
}

export const updateScore = (originNode: TransformNode, score: string) => {
  updateText(originNode, score, scoreJustify)
}
