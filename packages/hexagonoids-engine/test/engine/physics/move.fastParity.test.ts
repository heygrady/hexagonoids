import { Quaternion, Vector3 } from '@babylonjs/core/Maths/math.vector.js'
import { describe, expect, it } from 'vitest'
import type { BulletState, RockState, ShipState } from '../../../src/index.js'
import {
  headingToAngularVelocity,
  latLngToQuaternion,
  moveBullet,
  moveRock,
  moveShip,
  RADIUS,
} from '../../../src/index.js'

function orientationAlignment(a: Quaternion, b: Quaternion): number {
  const dot = a.x * b.x + a.y * b.y + a.z * b.z + a.w * b.w
  return Math.abs(dot)
}

function makeShip(overrides: Partial<ShipState> = {}): ShipState {
  return {
    id: 'ship-1',
    playerId: 'p1',
    orientation: Quaternion.Identity(),
    lat: 0,
    lng: 0,
    angularVelocity: Vector3.Zero(),
    yaw: 0,
    alive: true,
    firedAt: null,
    ...overrides,
  }
}

function makeRock(overrides: Partial<RockState> = {}): RockState {
  return {
    id: 'rock-1',
    orientation: Quaternion.Identity(),
    lat: 0,
    lng: 0,
    angularVelocity: Vector3.Zero(),
    size: 2,
    value: 50,
    ...overrides,
  }
}

function makeBullet(overrides: Partial<BulletState> = {}): BulletState {
  return {
    id: 'bullet-1',
    ownerId: 'ship-1',
    orientation: Quaternion.Identity(),
    lat: 0,
    lng: 0,
    angularVelocity: Vector3.Zero(),
    firedAt: null,
    ...overrides,
  }
}

describe('movement fast math parity', () => {
  it('moveShip fast and quaternion paths remain aligned over many steps', () => {
    const orientation = latLngToQuaternion(27, 61)
    const angularVelocity = headingToAngularVelocity(orientation, 0.85, 0.23)
    const fast = makeShip({
      orientation,
      lat: 27,
      lng: 61,
      angularVelocity: angularVelocity.clone(),
    })
    const slow = makeShip({
      orientation: orientation.clone(),
      lat: 27,
      lng: 61,
      angularVelocity: angularVelocity.clone(),
    })

    for (let i = 0; i < 120; i++) {
      moveShip(fast, 16, RADIUS, true)
      moveShip(slow, 16, RADIUS, false)
    }

    expect(fast.lat).toBeCloseTo(slow.lat, 5)
    expect(fast.lng).toBeCloseTo(slow.lng, 5)
    expect(
      orientationAlignment(fast.orientation, slow.orientation)
    ).toBeCloseTo(1, 5)
  })

  it('moveRock fast and quaternion paths match', () => {
    const orientation = latLngToQuaternion(-34, 112)
    const angularVelocity = headingToAngularVelocity(orientation, -0.4, 0.19)
    const fast = makeRock({
      orientation,
      lat: -34,
      lng: 112,
      angularVelocity: angularVelocity.clone(),
    })
    const slow = makeRock({
      orientation: orientation.clone(),
      lat: -34,
      lng: 112,
      angularVelocity: angularVelocity.clone(),
    })

    for (let i = 0; i < 160; i++) {
      moveRock(fast, 16, RADIUS, true)
      moveRock(slow, 16, RADIUS, false)
    }

    expect(fast.lat).toBeCloseTo(slow.lat, 5)
    expect(fast.lng).toBeCloseTo(slow.lng, 5)
    expect(
      orientationAlignment(fast.orientation, slow.orientation)
    ).toBeCloseTo(1, 5)
  })

  it('moveBullet fast and quaternion paths match', () => {
    const orientation = latLngToQuaternion(6, -145)
    const angularVelocity = headingToAngularVelocity(orientation, 1.3, 0.3)
    const fast = makeBullet({
      orientation,
      lat: 6,
      lng: -145,
      angularVelocity: angularVelocity.clone(),
    })
    const slow = makeBullet({
      orientation: orientation.clone(),
      lat: 6,
      lng: -145,
      angularVelocity: angularVelocity.clone(),
    })

    for (let i = 0; i < 90; i++) {
      moveBullet(fast, 16, RADIUS, true)
      moveBullet(slow, 16, RADIUS, false)
    }

    expect(fast.lat).toBeCloseTo(slow.lat, 5)
    expect(fast.lng).toBeCloseTo(slow.lng, 5)
    expect(
      orientationAlignment(fast.orientation, slow.orientation)
    ).toBeCloseTo(1, 5)
  })
})
