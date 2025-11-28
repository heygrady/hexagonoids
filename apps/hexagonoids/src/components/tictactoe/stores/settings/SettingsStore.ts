import { Activation } from '@neat-evolution/core'
import { map, type MapStore } from 'nanostores'

import {
  loadSettingsFromStorage,
  saveSettingsToStorage,
} from './SettingsPersistence.js'

export enum AlgorithmType {
  NEAT = 'NEAT',
  CPPN = 'CPPN',
  HyperNEAT = 'HyperNEAT',
  ES_HyperNEAT = 'ES-HyperNEAT',
  DES_HyperNEAT = 'DES-HyperNEAT',
}

// Settings that auto-apply immediately (non-destructive)
export interface AutoApplySettings {
  player1Emoji: string
  player2Emoji: string
  generationsPerMatch: number
  useBestOpponent: boolean
}

// Settings that require manual apply (destructive - reset evolution)
export interface ManualApplySettings {
  algorithm: AlgorithmType
  activation: Activation
}

export interface SettingsState {
  // Committed settings (currently active)
  committed: AutoApplySettings & ManualApplySettings
  // Draft settings (staged changes for manual-apply settings)
  draft: ManualApplySettings
  isOpen: boolean
  // Previous settings (captured before applying new settings, used for correct save key)
  previousAlgorithm?: AlgorithmType
  previousActivation?: Activation
}

const defaultManualApplySettings: ManualApplySettings = {
  algorithm: AlgorithmType.NEAT,
  activation: Activation.GELU,
}

const defaultAutoApplySettings: AutoApplySettings = {
  player1Emoji: '🦄',
  player2Emoji: '🌈',
  generationsPerMatch: 10,
  useBestOpponent: true,
}

export const defaultSettingsState: SettingsState = {
  committed: {
    ...defaultManualApplySettings,
    ...defaultAutoApplySettings,
  },
  draft: { ...defaultManualApplySettings },
  isOpen: false,
}

export type SettingsStore = MapStore<SettingsState>

/**
 * Creates a settings store and returns both the store and a promise that resolves
 * when settings have been loaded from storage.
 * @returns Tuple of [store, loadedPromise]
 */
export const createSettingsStore = (): [SettingsStore, Promise<void>] => {
  const store = map<SettingsState>(defaultSettingsState)

  // Create a promise that resolves when settings are loaded
  const loadedPromise = loadSettingsFromStorage()
    .then((stored) => {
      if (stored !== null && stored !== undefined) {
        const loaded = { ...defaultSettingsState.committed, ...stored }
        store.set({
          committed: loaded,
          draft: {
            algorithm: loaded.algorithm,
            activation: loaded.activation,
          },
          isOpen: false,
        })
      }
    })
    .catch((error) => {
      console.warn('Failed to load settings:', error)
    })

  // Auto-save committed settings when they change (excluding isOpen and draft)
  store.subscribe((settings) => {
    const { isOpen, draft, ...committedWrapper } = settings
    saveSettingsToStorage(committedWrapper.committed).catch((error) => {
      console.warn('Failed to save settings:', error)
    })
  })

  return [store, loadedPromise]
}
