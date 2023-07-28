import { Pool } from '../../../../utils/Pool'
import { ROCK_CACHE_SIZE } from '../../constants'
import {
  createPlayerStore,
  resetPlayer,
  type PlayerStore,
} from '../player/PlayerStore'

export type PlayerPool = Pool<PlayerStore>

// FIXME: copy the pattern from CellPool and RockPool
/**
 * INTERNAL USE ONLY. Use the PlayerPoolActions to manipulate.
 * Pool of unused players
 */
export const playerPool: PlayerPool = new Pool<PlayerStore>(
  createPlayerStore,
  resetPlayer,
  { maxSize: ROCK_CACHE_SIZE }
)
