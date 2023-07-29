import { vector3ToLatLng } from '@heygrady/h3-babylon'
import type { Component } from 'solid-js'
import { unwrap } from 'solid-js/store'

import { onBeforeRender } from '../solid-babylon/hooks/onBeforeRender'
import { useScene } from '../solid-babylon/hooks/useScene'

import {
  BULLET_LIFETIME,
  EXPLOSION_LARGE_LIFETIME,
  EXPLOSION_MEDIUM_LIFETIME,
  EXPLOSION_SMALL_LIFETIME,
  MAX_BULLET_SPEED,
  MAX_DELTA,
  ROCK_LARGE_SIZE,
  ROCK_MEDIUM_SIZE,
} from './constants'
import { useBulletPool } from './hooks/useBulletPool'
import { pitchNodeBy } from './ship/orientation'
import { setLocation } from './store/bullet/BulletSetters'
import type { BulletStore } from './store/bullet/BulletStore'
import { removeBullet } from './store/bulletPool/BulletPoolSetters'

export interface BulletProps {
  id?: string
  store: BulletStore
}

export const Bullet: Component<BulletProps> = (props) => {
  const scene = useScene()
  const $bullet = unwrap(props.store)

  const [$bullets] = useBulletPool()

  // Require id, originNode and bulletNode
  const bulletState = $bullet.get()
  const { id, originNode, bulletNode } = bulletState

  if (id === undefined) {
    throw new Error('Cannot render a bullet without a BulletState.id')
  }
  if (originNode == null) {
    throw new Error('Cannot render a bullet without a BulletState.originNode')
  }
  if (bulletNode == null) {
    throw new Error('Cannot render a bullet without a BulletState.bulletNode')
  }

  const render = () => {
    const bulletState = $bullet.get()
    const { type, size, bulletNode, originNode } = bulletState

    if (originNode == null) {
      throw new Error('Cannot render a bullet without a BulletState.originNode')
    }
    if (bulletNode == null) {
      throw new Error('Cannot render a bullet without a BulletState.bulletNode')
    }

    const now = Date.now()

    // Manage lifetime
    const duration = now - (bulletState.firedAt ?? now)
    let maxLifetime =
      type === 'bullet'
        ? BULLET_LIFETIME
        : size === ROCK_LARGE_SIZE
        ? EXPLOSION_LARGE_LIFETIME
        : size === ROCK_MEDIUM_SIZE
        ? EXPLOSION_MEDIUM_LIFETIME
        : EXPLOSION_SMALL_LIFETIME

    if (type === 'explosion') {
      // randomly increase lifetime
      maxLifetime = maxLifetime + Math.random() * maxLifetime
    }
    if (duration > maxLifetime) {
      // remove the bullet from the scene
      removeBullet($bullets, $bullet)
      return
    }

    // Move the bullet
    if (bulletState.speed > 0) {
      const speed = Math.min(bulletState.speed, MAX_BULLET_SPEED)
      const delta = Math.min(MAX_DELTA, scene.getEngine().getDeltaTime())
      const distance = (speed / 1000) * delta

      // FIXME: should be larger than MIN_DISTANCE
      if (distance === 0) {
        return
      }

      // Pitch the bullet forward by distance radians
      pitchNodeBy(originNode, distance)
      setLocation($bullet, vector3ToLatLng(bulletNode.absolutePosition))
    }
  }

  onBeforeRender(render)

  return null
}
