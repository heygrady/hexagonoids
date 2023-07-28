export interface ControlState {
  leftPressed: boolean
  leftPressedAt: number | null
  leftAcked: boolean
  rightPressed: boolean
  rightPressedAt: number | null
  rightAcked: boolean
  acceleratePressed: boolean
  acceleratePressedAt: number | null
  accelerateAcked: boolean
  firePressed: boolean
  firePressedAt: number | null
  fireAcked: boolean
}

export const defaultControlState: ControlState = {
  leftPressed: false,
  leftPressedAt: null,
  leftAcked: true,
  rightPressed: false,
  rightPressedAt: null,
  rightAcked: true,
  acceleratePressed: false,
  acceleratePressedAt: null,
  accelerateAcked: true,
  firePressed: false,
  firePressedAt: null,
  fireAcked: true,
}
