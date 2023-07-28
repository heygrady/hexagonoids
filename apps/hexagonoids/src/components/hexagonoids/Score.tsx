import { type TransformNode, Vector3 } from '@babylonjs/core'
import { type Component, createRenderEffect, onCleanup } from 'solid-js'

import { onBeforeRender } from '../solid-babylon/hooks/onBeforeRender'
import { useScene } from '../solid-babylon/hooks/useScene'

import { createLivesNode, updateLives } from './hud/createLivesNode'
import { createScoreNodes, updateScore } from './hud/createScoreNodes'
import { usePlayer } from './KeyboardPlayer'
import { useUI } from './UI'

export const Score: Component = () => {
  const scene = useScene()
  const [$player] = usePlayer()
  const hudNode = useUI()

  let scoreNode: TransformNode | null = null
  let livesNode: TransformNode | null = null
  let prevScore = 0
  let prevLives = 0

  let prevStartedAt: number | null = null
  let started = false

  createRenderEffect(() => {
    const { score, lives } = $player.get()
    prevScore = score
    prevLives = lives

    scoreNode = createScoreNodes(scene, String(score))
    scoreNode.scaling.setAll(0.1)
    scoreNode.position = new Vector3(1.03, 0, -0.45)

    livesNode = createLivesNode(scene, lives)
    livesNode.position = new Vector3(1.05, 0, -0.35)

    // place the score in he hud
    scoreNode.parent = hudNode
    livesNode.parent = hudNode
  })

  // Update the HUD elements with the current score and lives
  onBeforeRender(() => {
    const { score, lives, startedAt } = $player.get()

    // FIXME: use solid effects for this
    if (startedAt == null) {
      scoreNode?.getChildMeshes().forEach((mesh) => {
        mesh.isVisible = false
      })
      livesNode?.getChildMeshes().forEach((mesh) => {
        mesh.isVisible = false
      })
    } else if (!started) {
      started = true
      scoreNode?.getChildMeshes().forEach((mesh) => {
        mesh.isVisible = true
      })
      livesNode?.getChildMeshes().forEach((mesh) => {
        mesh.isVisible = true
      })
    }

    if (
      (score !== prevScore || prevStartedAt !== startedAt) &&
      scoreNode != null
    ) {
      updateScore(scoreNode, String(score))
      prevScore = score
      prevStartedAt = startedAt
    }
    if (
      (lives !== prevLives || prevStartedAt !== startedAt) &&
      livesNode != null
    ) {
      updateLives(livesNode, lives)
      prevLives = lives
      prevStartedAt = startedAt
    }
  })
  onCleanup(() => {
    ;[scoreNode, livesNode].forEach((node) => {
      node?.dispose()
    })
  })
  return null
}
