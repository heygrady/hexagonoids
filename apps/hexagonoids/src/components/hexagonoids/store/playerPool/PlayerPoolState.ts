import type { PlayerStore } from '../player/PlayerStore'

export type PlayerPoolState = Record<string, PlayerStore | undefined>
