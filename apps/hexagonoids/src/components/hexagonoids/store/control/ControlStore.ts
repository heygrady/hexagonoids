import { map, type MapStore } from 'nanostores'

import { defaultControlState, type ControlState } from './ControlState'

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
