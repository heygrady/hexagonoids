import { useStore } from '@nanostores/solid'

import {
  bindSettingsSetters,
  type SettingsSetters,
} from '../stores/settings/SettingsSetters.js'
import type { SettingsStore } from '../stores/settings/SettingsStore.js'

import { useGame } from './useGame.js'

export const useSettings = (): [
  $settings: SettingsStore,
  actions: SettingsSetters,
] => {
  const [$game] = useGame()
  const $settings = $game.get().$settings
  return [$settings, bindSettingsSetters($settings)]
}

export const subscribeSettings = () => {
  const [$settings] = useSettings()
  return useStore($settings)
}
