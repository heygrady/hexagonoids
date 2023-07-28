import { PLAYER_STARTING_LIVES } from '../../constants'
import type { ShipStore } from '../ship/ShipStore'

export interface PlayerState {
  id?: string
  alive: boolean
  score: number
  lives: number
  startedAt: number | null
  regeneratedAt: number | null
  diedAt: number | null
  waveSpawnedAt: number | null
  $ship: ShipStore | null
}

export const defaultPlayerState: PlayerState = {
  score: 0,
  alive: true,
  lives: PLAYER_STARTING_LIVES,
  startedAt: null,
  waveSpawnedAt: null,
  regeneratedAt: null,
  diedAt: null,
  $ship: null,
}
