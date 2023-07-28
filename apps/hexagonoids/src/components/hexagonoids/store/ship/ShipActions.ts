import { action } from 'nanostores'
import type { OmitFirstArg } from 'nanostores/action'

import { accelerateShip } from '../../ship/accelerateShip'
import { moveShip } from '../../ship/moveShip'
import { turnShip } from '../../ship/turnShip'
import { fireBullet } from '../bulletPool/BulletPoolActions'
import type { BulletPoolStore } from '../bulletPool/BulletPoolStore'
import { fireAck } from '../control/ControlActions'

import type { ShipStore } from './ShipStore'

export interface ShipActions {
  accelerate: OmitFirstArg<typeof accelerate>
  move: OmitFirstArg<typeof move>
  turn: OmitFirstArg<typeof turn>
}

export interface ShipActionsWithBulletPool extends ShipActions {
  fire: OmitFirstArg<OmitFirstArg<typeof fireBullet>>
}

export const bindShipActions = (
  $ship: ShipStore,
  $bullets?: BulletPoolStore
): ShipActions | ShipActionsWithBulletPool => {
  const actions: ShipActions = {
    accelerate: action($ship, 'accelerate', accelerate),
    move: action($ship, 'move', move),
    turn: action($ship, 'turn', turn),
  }
  if ($bullets != null) {
    const extendedActions: ShipActionsWithBulletPool = {
      ...actions,
      fire: action($bullets, 'fireBullet', ($bullets) => {
        const $control = $ship.get().$control
        if ($control != null) {
          fireAck($control)
        }
        return fireBullet($bullets, $ship)
      }),
    }
    return extendedActions
  }
  return actions
}

export const accelerate = (
  $ship: ShipStore,
  delta: number,
  duration: number
) => {
  // FIXME: move setters out of accelerateShip
  accelerateShip($ship, delta, duration)
}
export const move = ($ship: ShipStore, delta: number, duration: number) => {
  // FIXME: move setters out of moveShip
  moveShip($ship, delta, duration)
}
export const turn = ($ship: ShipStore, delta: number, duration: number) => {
  // FIXME: move setters out of turnShip
  turnShip($ship, delta, duration)
}
