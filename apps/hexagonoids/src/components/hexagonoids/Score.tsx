import { Vector3 } from '@babylonjs/core/Maths/math.vector'
import type { TransformNode } from '@babylonjs/core/Meshes/transformNode'
import { useGameState } from '@heygrady/hexagonoids-engine/solid'
import { type Component, onCleanup } from 'solid-js'

import { useScene } from '../solid-babylon/hooks/useScene'

import { DEFAULT_PLAYER_ID } from './constants'
import { createLivesNode, updateLives } from './hud/createLivesNode'
import { createScoreNodes, updateScore } from './hud/createScoreNodes'
import { useUI } from './UI'

const PLAYER_ID = DEFAULT_PLAYER_ID

export const Score: Component = () => {
  const scene = useScene()
  const engine = useGameState()
  const hudNode = useUI()
  let scoreNode: TransformNode | null = null
  let livesNode: TransformNode | null = null
  let prevScore = -1
  let prevLives = -1
  let started = false

  // Create HUD nodes
  scoreNode = createScoreNodes(scene, '0')
  scoreNode.scaling.setAll(0.1)
  scoreNode.position = new Vector3(1.03, 0, -0.45)
  scoreNode.parent = hudNode

  livesNode = createLivesNode(scene, 0)
  livesNode.position = new Vector3(1.05, 0, -0.35)
  livesNode.parent = hudNode

  // Hide initially until game starts
  scoreNode.getChildMeshes().forEach((mesh) => {
    mesh.isVisible = false
  })
  livesNode.getChildMeshes().forEach((mesh) => {
    mesh.isVisible = false
  })

  const observer = scene.onBeforeRenderObservable.add(() => {
    const player = engine.state.players.get(PLAYER_ID)
    const playerStartedAt = player?.startedAt

    if (playerStartedAt == null) {
      scoreNode?.getChildMeshes().forEach((mesh) => {
        mesh.isVisible = false
      })
      livesNode?.getChildMeshes().forEach((mesh) => {
        mesh.isVisible = false
      })
      started = false
      return
    }

    if (!started) {
      started = true
      scoreNode?.getChildMeshes().forEach((mesh) => {
        mesh.isVisible = true
      })
      livesNode?.getChildMeshes().forEach((mesh) => {
        mesh.isVisible = true
      })
    }

    const currentScore = player?.score ?? 0
    const currentLives = player?.lives ?? 0

    if (currentScore !== prevScore && scoreNode != null) {
      updateScore(scoreNode, String(currentScore))
      prevScore = currentScore
    }
    if (currentLives !== prevLives && livesNode != null) {
      updateLives(livesNode, currentLives)
      prevLives = currentLives
    }
  })

  onCleanup(() => {
    scene.onBeforeRenderObservable.remove(observer)
    ;[scoreNode, livesNode].forEach((node) => {
      node?.dispose()
    })
  })

  return null
}
