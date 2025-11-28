import { get, set, del } from 'idb-keyval'

import type { MatchRecord } from './GameState.js'

const PLAYER_DATA_STORAGE_KEY = 'tictactoe-player-data'

/**
 * Player data stored in IndexedDB
 */
export interface PersistedPlayerData {
  playerGlickoData: {
    rating: number
    rd: number
    vol: number
  }
  matchHistory: MatchRecord[]
  matchCounter: number
}

/**
 * Load player data from IndexedDB.
 * @returns {Promise<PersistedPlayerData | null>} Player data object or null if not found
 */
export const loadPlayerDataFromStorage =
  async (): Promise<PersistedPlayerData | null> => {
    try {
      const stored = await get<PersistedPlayerData>(PLAYER_DATA_STORAGE_KEY)
      return stored ?? null
    } catch (error) {
      console.warn('Failed to load player data from IndexedDB:', error)
      return null
    }
  }

/**
 * Save player data to IndexedDB.
 * @param {object} playerGlickoData - Current player Glicko-2 rating data
 * @param playerGlickoData.rating
 * @param {MatchRecord[]} matchHistory - Match history array
 * @param playerGlickoData.rd
 * @param {number} matchCounter - Current match counter
 * @param playerGlickoData.vol
 */
export const savePlayerDataToStorage = async (
  playerGlickoData: { rating: number; rd: number; vol: number },
  matchHistory: MatchRecord[],
  matchCounter: number
): Promise<void> => {
  try {
    const data: PersistedPlayerData = {
      playerGlickoData,
      matchHistory,
      matchCounter,
    }
    await set(PLAYER_DATA_STORAGE_KEY, data)
  } catch (error) {
    console.warn('Failed to save player data to IndexedDB:', error)
  }
}

/**
 * Clear player data from IndexedDB.
 */
export const clearPlayerDataFromStorage = async (): Promise<void> => {
  try {
    await del(PLAYER_DATA_STORAGE_KEY)
  } catch (error) {
    console.warn('Failed to clear player data from IndexedDB:', error)
  }
}
