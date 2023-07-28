import { action } from 'nanostores'
import type { OmitFirstArg } from 'nanostores/action'

import type { ControlStore } from './ControlStore'

export interface ControlActions {
  leftDown: OmitFirstArg<typeof leftDown>
  leftUp: OmitFirstArg<typeof leftUp>
  rightDown: OmitFirstArg<typeof rightDown>
  rightUp: OmitFirstArg<typeof rightUp>
  accelerateDown: OmitFirstArg<typeof accelerateDown>
  accelerateUp: OmitFirstArg<typeof accelerateUp>
  fireDown: OmitFirstArg<typeof fireDown>
  fireUp: OmitFirstArg<typeof fireUp>
}

export const bindControlActions = ($control: ControlStore) => ({
  leftDown: action($control, 'leftDown', leftDown),
  leftUp: action($control, 'leftUp', leftUp),
  rightDown: action($control, 'rightDown', rightDown),
  rightUp: action($control, 'rightUp', rightUp),
  accelerateDown: action($control, 'accelerateDown', accelerateDown),
  accelerateUp: action($control, 'accelerateUp', accelerateUp),
  fireDown: action($control, 'fireDown', fireDown),
  fireUp: action($control, 'fireUp', fireUp),
})

export const leftDown = ($control: ControlStore) => {
  if (!$control.get().leftPressed) {
    $control.setKey('leftPressed', true)
    $control.setKey('leftPressedAt', Date.now())
    $control.setKey('leftAcked', false)
  }
}
export const leftUp = ($control: ControlStore) => {
  if ($control.get().leftPressed) {
    $control.setKey('leftPressed', false)
    $control.setKey('leftPressedAt', null)
  }
}
export const leftAck = ($control: ControlStore) => {
  if (!$control.get().leftAcked) {
    $control.setKey('leftAcked', true)
  }
}

export const rightDown = ($control: ControlStore) => {
  if (!$control.get().rightPressed) {
    $control.setKey('rightPressed', true)
    $control.setKey('rightPressedAt', Date.now())
    $control.setKey('rightAcked', false)
  }
}
export const rightUp = ($control: ControlStore) => {
  if ($control.get().rightPressed) {
    $control.setKey('rightPressed', false)
    $control.setKey('rightPressedAt', null)
  }
}
export const rightAck = ($control: ControlStore) => {
  if (!$control.get().rightAcked) {
    $control.setKey('rightAcked', true)
  }
}
export const accelerateDown = ($control: ControlStore) => {
  if (!$control.get().acceleratePressed) {
    $control.setKey('acceleratePressed', true)
    $control.setKey('acceleratePressedAt', Date.now())
    $control.setKey('accelerateAcked', false)
  }
}
export const accelerateUp = ($control: ControlStore) => {
  if ($control.get().acceleratePressed) {
    $control.setKey('acceleratePressed', false)
    $control.setKey('acceleratePressedAt', null)
  }
}
export const accelerateAck = ($control: ControlStore) => {
  if (!$control.get().accelerateAcked) {
    $control.setKey('accelerateAcked', true)
  }
}
export const fireDown = ($control: ControlStore) => {
  if (!$control.get().firePressed) {
    $control.setKey('firePressed', true)
    $control.setKey('firePressedAt', Date.now())
    $control.setKey('fireAcked', false)
  }
}
export const fireUp = ($control: ControlStore) => {
  if ($control.get().firePressed) {
    $control.setKey('firePressed', false)
    $control.setKey('firePressedAt', null)
  }
}

export const fireAck = ($control: ControlStore) => {
  if (!$control.get().fireAcked) {
    $control.setKey('fireAcked', true)
  }
}
