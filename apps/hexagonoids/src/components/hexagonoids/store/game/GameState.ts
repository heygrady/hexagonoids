import type { BulletPoolStore } from '../bulletPool/BulletPoolStore'
import type { CellPoolStore } from '../cellPool/CellPoolStore'
import type { PlayerStore } from '../player/PlayerStore'
import type { PlayerPoolStore } from '../playerPool/PlayerPoolStore'
import type { RockPoolStore } from '../rockPool/RockPoolStore'
import type { ShipPoolStore } from '../shipPool/ShipPoolStore'

export interface GameState {
  $bullets: BulletPoolStore
  $cells: CellPoolStore
  $player?: PlayerStore
  $players: PlayerPoolStore
  $rocks: RockPoolStore
  $ships: ShipPoolStore
  startedAt: number | null
  endedAt: number | null
}

export const defaultGameState: Partial<GameState> = {}
