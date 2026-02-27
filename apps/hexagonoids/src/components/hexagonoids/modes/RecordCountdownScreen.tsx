import { Color3 } from '@babylonjs/core/Maths/math.color'
import { TransformNode } from '@babylonjs/core/Meshes/transformNode'
import type { Component } from 'solid-js'
import { createEffect, onCleanup } from 'solid-js'

import { useScene } from '../../solid-babylon/hooks/useScene'
import { getCommonMaterial } from '../common/commonMaterial'
import { updateText } from '../hud/createTextMesh'
import { useUI } from '../UI'
import { useAppMode } from './AppModeProvider'
import { BENCHMARK_SEEDS, RECORD_COUNTDOWN_ZERO_HOLD_MS } from './constants'

/**
 * In-world countdown shown during record mode pre-round pause.
 * Renders inside the Babylon HUD node so it matches start/end screens.
 */
export const RecordCountdownScreen: Component = () => {
  const scene = useScene()
  const hudNode = useUI()
  const { appMode, recordCountdownMs, recordRoundIndex } = useAppMode()

  const material = getCommonMaterial(scene, {
    emissiveColor: new Color3(1, 0.9, 0.2),
  })

  const textOrigin = new TransformNode('recordCountdown', scene)
  textOrigin.parent = hudNode
  textOrigin.position.z = 0.22
  textOrigin.setEnabled(false)

  createEffect(() => {
    const inRecordCountdown =
      appMode() === 'record' &&
      recordCountdownMs() > 0 &&
      BENCHMARK_SEEDS.length > 0

    if (!inRecordCountdown) {
      textOrigin.getChildMeshes().forEach((mesh) => {
        mesh.isVisible = false
      })
      textOrigin.setEnabled(false)
      return
    }

    const ms = recordCountdownMs()
    const seconds =
      ms <= RECORD_COUNTDOWN_ZERO_HOLD_MS
        ? 0
        : Math.max(1, Math.ceil((ms - RECORD_COUNTDOWN_ZERO_HOLD_MS) / 1000))
    const round = Math.min(recordRoundIndex() + 1, BENCHMARK_SEEDS.length)
    updateText(textOrigin, `Round ${round} starting in ${seconds}...`)
    textOrigin.setEnabled(true)
    textOrigin.getChildMeshes().forEach((mesh) => {
      mesh.scaling.setAll(0.06)
      mesh.material = material
      mesh.isVisible = true
    })
  })

  onCleanup(() => {
    textOrigin.dispose(false, true)
  })

  return null
}
