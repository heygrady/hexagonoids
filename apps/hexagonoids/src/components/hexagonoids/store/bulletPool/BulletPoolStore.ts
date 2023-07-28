import { map, type MapStore } from 'nanostores'

import type { BulletRecord } from './BulletPoolState'

export type BulletPoolStore = MapStore<BulletRecord>

export const createBulletPoolStore = (): BulletPoolStore => {
  const $bullets = map<BulletRecord>({})
  return $bullets
}
