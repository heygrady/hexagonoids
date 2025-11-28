import { get, set, del } from 'idb-keyval'

import type { SettingsState } from './SettingsStore.js'

const SETTINGS_STORAGE_KEY = 'tictactoe-settings'

/**
 * Load settings from IndexedDB.
 * @returns {Promise<Partial<SettingsState> | null>} Partial settings object or null if not found
 */
export const loadSettingsFromStorage =
  async (): Promise<Partial<SettingsState> | null> => {
    try {
      const stored = await get<Partial<SettingsState>>(SETTINGS_STORAGE_KEY)
      return stored ?? null
    } catch (error) {
      console.warn('Failed to load settings from IndexedDB:', error)
      return null
    }
  }

/**
 * Save settings to IndexedDB.
 * @param {SettingsState} settings - Settings to save
 */
export const saveSettingsToStorage = async (
  settings: SettingsState
): Promise<void> => {
  try {
    const { isOpen, ...persistableSettings } = settings
    await set(SETTINGS_STORAGE_KEY, persistableSettings)
  } catch (error) {
    console.warn('Failed to save settings to IndexedDB:', error)
  }
}

/**
 * Clear settings from IndexedDB.
 */
export const clearSettingsFromStorage = async (): Promise<void> => {
  try {
    await del(SETTINGS_STORAGE_KEY)
  } catch (error) {
    console.warn('Failed to clear settings from IndexedDB:', error)
  }
}
