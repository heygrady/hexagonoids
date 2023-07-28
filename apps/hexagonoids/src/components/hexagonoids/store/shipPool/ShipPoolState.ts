import type { ShipStore } from '../ship/ShipStore'

export type ShipPoolState = Record<string, ShipStore | undefined>
