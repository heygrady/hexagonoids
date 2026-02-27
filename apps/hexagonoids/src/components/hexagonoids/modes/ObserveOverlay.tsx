import { Color3 } from '@babylonjs/core/Maths/math.color'
import { TransformNode } from '@babylonjs/core/Meshes/transformNode'
import { useGameState } from '@heygrady/hexagonoids-engine/solid'
import { type Component, createEffect, onCleanup } from 'solid-js'

import { useScene } from '../../solid-babylon/hooks/useScene'
import { getCommonMaterial } from '../common/commonMaterial'
import { updateText } from '../hud/createTextMesh'
import { useUI } from '../UI'
import { useAppMode } from './AppModeProvider'

export const ObserveOverlay: Component = () => {
  const scene = useScene()
  const engine = useGameState()
  const hudNode = useUI()
  const {
    appMode,
    observeTrainingGeneration,
    observeTrainingElapsedSeconds,
    observeRunningGeneration,
    observeRunningFitness,
    observeSummary,
  } = useAppMode()

  const trainingMaterial = getCommonMaterial(scene, {
    emissiveColor: new Color3(1, 0.9, 0.2),
  })
  const runningMaterial = getCommonMaterial(scene, {
    emissiveColor: Color3.White(),
  })
  const summaryMaterial = getCommonMaterial(scene, {
    emissiveColor: Color3.White(),
  })
  const summaryHintMaterial = getCommonMaterial(scene, {
    emissiveColor: new Color3(0.7, 0.7, 0.7),
  })

  const trainingOrigin = new TransformNode('observeTrainingText', scene)
  trainingOrigin.parent = hudNode
  trainingOrigin.position.set(0, 0, 0.22)
  trainingOrigin.setEnabled(false)

  const runningOrigin = new TransformNode('observeRunningText', scene)
  runningOrigin.parent = hudNode
  runningOrigin.position.set(0, 0, 0.34)
  runningOrigin.setEnabled(false)

  const summaryLine1Origin = new TransformNode('observeSummaryLine1', scene)
  summaryLine1Origin.parent = hudNode
  summaryLine1Origin.position.set(0, 0.02, 0.22)
  summaryLine1Origin.setEnabled(false)

  const summaryLine2Origin = new TransformNode('observeSummaryLine2', scene)
  summaryLine2Origin.parent = hudNode
  summaryLine2Origin.position.set(0, -0.08, 0.22)
  summaryLine2Origin.setEnabled(false)

  const hideNode = (origin: TransformNode) => {
    origin.setEnabled(false)
    origin.getChildMeshes().forEach((mesh) => {
      mesh.isVisible = false
    })
  }

  createEffect(() => {
    const inObserveMode = appMode() === 'observe'
    if (!inObserveMode) {
      hideNode(trainingOrigin)
      hideNode(runningOrigin)
      hideNode(summaryLine1Origin)
      hideNode(summaryLine2Origin)
      return
    }

    const summary = observeSummary()
    if (summary != null && engine.state.endedAt == null) {
      hideNode(trainingOrigin)
      hideNode(runningOrigin)

      updateText(
        summaryLine1Origin,
        `Trained ${summary.generations} generations. Best fitness ${summary.bestFitness.toFixed(2)} at generation ${summary.bestGeneration}.`
      )
      summaryLine1Origin.setEnabled(true)
      summaryLine1Origin.getChildMeshes().forEach((mesh) => {
        mesh.scaling.setAll(0.042)
        mesh.material = summaryMaterial
        mesh.isVisible = true
      })

      updateText(
        summaryLine2Origin,
        'Space: Play | Shift+O: Observe | Shift+S: Spawn Debug'
      )
      summaryLine2Origin.setEnabled(true)
      summaryLine2Origin.getChildMeshes().forEach((mesh) => {
        mesh.scaling.setAll(0.036)
        mesh.material = summaryHintMaterial
        mesh.isVisible = true
      })
      return
    }

    hideNode(summaryLine1Origin)
    hideNode(summaryLine2Origin)
    const runningGeneration = observeRunningGeneration()
    if (runningGeneration != null) {
      hideNode(trainingOrigin)
      updateText(
        runningOrigin,
        `Generation ${runningGeneration}, Fitness ${(observeRunningFitness() ?? 0).toFixed(2)}`
      )
      runningOrigin.setEnabled(true)
      runningOrigin.getChildMeshes().forEach((mesh) => {
        mesh.scaling.setAll(0.05)
        mesh.material = runningMaterial
        mesh.isVisible = true
      })
      return
    }

    hideNode(runningOrigin)
    updateText(
      trainingOrigin,
      `Training Generation ${observeTrainingGeneration()} for ${observeTrainingElapsedSeconds()}s`
    )
    trainingOrigin.setEnabled(true)
    trainingOrigin.getChildMeshes().forEach((mesh) => {
      mesh.scaling.setAll(0.05)
      mesh.material = trainingMaterial
      mesh.isVisible = true
    })
  })

  onCleanup(() => {
    trainingOrigin.dispose(false, true)
    runningOrigin.dispose(false, true)
    summaryLine1Origin.dispose(false, true)
    summaryLine2Origin.dispose(false, true)
  })

  return null
}
