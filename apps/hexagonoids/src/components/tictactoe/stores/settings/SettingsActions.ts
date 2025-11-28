import type { Activation } from '@neat-evolution/core'

import type { AlgorithmType, SettingsStore } from './SettingsStore.js'

export interface SettingsActions {
  applySettings: () => Promise<void>
  confirmAndApplySettings: () => Promise<void>
}

export type SettingsChangeCallback = (settings: {
  algorithm: AlgorithmType
  activation: Activation
  iterations: number
  initialMutations: number
  populationSize: number
}) => Promise<void>

/**
 * Create settings actions bound to a settings store.
 * @param {SettingsStore} $settings - The settings store
 * @param {SettingsChangeCallback} onSettingsChange - Callback to handle settings changes that require evolution restart
 * @returns {SettingsActions} Settings actions
 */
export const createSettingsActions = (
  $settings: SettingsStore,
  onSettingsChange?: SettingsChangeCallback
): SettingsActions => {
  const applySettings = async () => {
    const settings = $settings.get()
    if (onSettingsChange !== undefined) {
      await onSettingsChange({
        algorithm: settings.algorithm,
        activation: settings.activation,
        iterations: settings.iterations,
        initialMutations: settings.initialMutations,
        populationSize: settings.populationSize,
      })
    }
  }

  const confirmAndApplySettings = async () => {
    const confirmed = window.confirm(
      'Changing these settings will restart evolution. All current progress will be lost. Continue?'
    )
    if (confirmed) {
      await applySettings()
    }
  }

  return {
    applySettings,
    confirmAndApplySettings,
  }
}
