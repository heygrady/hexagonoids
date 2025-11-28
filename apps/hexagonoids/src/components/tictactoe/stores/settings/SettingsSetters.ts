import { type Activation } from '@neat-evolution/core'
import { action } from 'nanostores'
import type { OmitFirstArg } from 'nanostores/action'

import type { AlgorithmType, SettingsStore } from './SettingsStore.js'

export interface SettingsSetters {
  // Draft setters (for manual-apply settings)
  setDraftAlgorithm: OmitFirstArg<typeof setDraftAlgorithm>
  setDraftActivation: OmitFirstArg<typeof setDraftActivation>
  // Committed setters (for auto-apply settings)
  setPlayer1Emoji: OmitFirstArg<typeof setPlayer1Emoji>
  setPlayer2Emoji: OmitFirstArg<typeof setPlayer2Emoji>
  setGenerationsPerMatch: OmitFirstArg<typeof setGenerationsPerMatch>
  setUseBestOpponent: OmitFirstArg<typeof setUseBestOpponent>
  // Other setters
  setIsOpen: OmitFirstArg<typeof setIsOpen>
  applyDraftSettings: OmitFirstArg<typeof applyDraftSettings>
  cancelDraftSettings: OmitFirstArg<typeof cancelDraftSettings>
}

export const bindSettingsSetters = (
  $settings: SettingsStore
): SettingsSetters => ({
  setDraftAlgorithm: action($settings, 'setDraftAlgorithm', setDraftAlgorithm),
  setDraftActivation: action(
    $settings,
    'setDraftActivation',
    setDraftActivation
  ),
  setPlayer1Emoji: action($settings, 'setPlayer1Emoji', setPlayer1Emoji),
  setPlayer2Emoji: action($settings, 'setPlayer2Emoji', setPlayer2Emoji),
  setGenerationsPerMatch: action(
    $settings,
    'setGenerationsPerMatch',
    setGenerationsPerMatch
  ),
  setUseBestOpponent: action(
    $settings,
    'setUseBestOpponent',
    setUseBestOpponent
  ),
  setIsOpen: action($settings, 'setIsOpen', setIsOpen),
  applyDraftSettings: action(
    $settings,
    'applyDraftSettings',
    applyDraftSettings
  ),
  cancelDraftSettings: action(
    $settings,
    'cancelDraftSettings',
    cancelDraftSettings
  ),
})

// Draft setters (for manual-apply settings)
export const setDraftAlgorithm = (
  $settings: SettingsStore,
  algorithm: AlgorithmType
) => {
  const current = $settings.get()
  $settings.set({
    ...current,
    draft: { ...current.draft, algorithm },
  })
}

export const setDraftActivation = (
  $settings: SettingsStore,
  activation: Activation
) => {
  const current = $settings.get()
  $settings.set({
    ...current,
    draft: { ...current.draft, activation },
  })
}

// Auto-apply setters (commit immediately)
export const setPlayer1Emoji = ($settings: SettingsStore, emoji: string) => {
  const current = $settings.get()
  $settings.set({
    ...current,
    committed: { ...current.committed, player1Emoji: emoji },
  })
}

export const setPlayer2Emoji = ($settings: SettingsStore, emoji: string) => {
  const current = $settings.get()
  $settings.set({
    ...current,
    committed: { ...current.committed, player2Emoji: emoji },
  })
}

export const setGenerationsPerMatch = (
  $settings: SettingsStore,
  generations: number
) => {
  const current = $settings.get()
  $settings.set({
    ...current,
    committed: { ...current.committed, generationsPerMatch: generations },
  })
}

export const setUseBestOpponent = (
  $settings: SettingsStore,
  useBestOpponent: boolean
) => {
  const current = $settings.get()
  $settings.set({
    ...current,
    committed: { ...current.committed, useBestOpponent },
  })
}

export const setIsOpen = ($settings: SettingsStore, isOpen: boolean) => {
  const current = $settings.get()
  $settings.set({ ...current, isOpen })
}

// Apply draft settings to committed
export const applyDraftSettings = ($settings: SettingsStore) => {
  const current = $settings.get()
  // Capture previous settings before overwriting (for correct save key in restart)
  $settings.set({
    ...current,
    previousAlgorithm: current.committed.algorithm,
    previousActivation: current.committed.activation,
    committed: { ...current.committed, ...current.draft },
  })
}

// Cancel draft changes
export const cancelDraftSettings = ($settings: SettingsStore) => {
  const current = $settings.get()
  $settings.set({
    ...current,
    draft: {
      algorithm: current.committed.algorithm,
      activation: current.committed.activation,
    },
  })
}
