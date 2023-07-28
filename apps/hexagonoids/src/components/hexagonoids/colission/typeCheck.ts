import type { BulletState } from '../store/bullet/BulletState'
import type { BulletStore } from '../store/bullet/BulletStore'
import type { RockState } from '../store/rock/RockState'
import type { RockStore } from '../store/rock/RockStore'
import type { ShipState } from '../store/ship/ShipState'
import type { ShipStore } from '../store/ship/ShipStore'

export type TargetStore = RockStore | ShipStore
export type ProjectileStore = BulletStore | ShipStore

export const isBulletState = (
  state: RockState | BulletState | ShipState
): state is BulletState => {
  return (state as BulletState).bulletNode !== undefined
}

export const isRockState = (
  state: RockState | BulletState | ShipState
): state is RockState => {
  return (state as RockState).rockNode !== undefined
}

export const isShipState = (
  state: RockState | BulletState | ShipState
): state is ShipState => {
  return (state as ShipState).shipNode !== undefined
}

export const isBulletStore = (
  $store: RockStore | BulletStore | ShipStore
): $store is BulletStore => {
  return ($store.get() as BulletState).bulletNode !== undefined
}

export const isRockStore = (
  $store: RockStore | BulletStore | ShipStore
): $store is RockStore => {
  return ($store.get() as RockState).rockNode !== undefined
}

export const isShipStore = (
  $store: RockStore | BulletStore | ShipStore
): $store is ShipStore => {
  return ($store.get() as ShipState).shipNode !== undefined
}
