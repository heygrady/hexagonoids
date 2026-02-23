import { type MapStore, map } from 'nanostores'

import { type ControlState, defaultControlState } from './ControlState'

export type ControlStore = MapStore<ControlState>

export const createControlStore = (): ControlStore => {
  const $control = map<ControlState>(defaultControlState)
  return $control
}

export const resetControl = ($control: ControlStore) => {
  $control.set({
    ...defaultControlState,
  })
}
