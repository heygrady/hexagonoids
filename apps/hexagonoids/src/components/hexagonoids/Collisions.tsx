import { For, type Component } from 'solid-js'

import { onAfterRender } from '../solid-babylon/hooks/onAfterRender'
import { useSceneStore } from '../solid-babylon/hooks/useScene'

import { detectCollisions } from './colission/detectCollisions'
import { handleCollisionPartners } from './colission/handleCollisionPartners'
import type { ProjectileStore, TargetStore } from './colission/typeCheck'
import { Collision } from './Collision'
import {
  BULLET_RESOLUTION,
  ROCK_LARGE_RESOLUTION,
  ROCK_LARGE_SIZE,
  ROCK_MEDIUM_RESOLUTION,
  ROCK_MEDIUM_SIZE,
  ROCK_SMALL_RESOLUTION,
  SHIP_RESOLUTION,
} from './constants'
import { subscribeBulletPool } from './hooks/useBulletPool'
import { useGame } from './hooks/useGame'
import { subscribeRockPool } from './hooks/useRockPool'
import { subscribeShipPool } from './hooks/useShipPool'
import type { BulletStore } from './store/bullet/BulletStore'
import type { RockStore } from './store/rock/RockStore'
import type { ShipStore } from './store/ship/ShipStore'

export const Collisions: Component = () => {
  const [$game, gameActions] = useGame()
  const [$scene] = useSceneStore()
  const bullets = subscribeBulletPool()
  const rocks = subscribeRockPool()
  const ships = subscribeShipPool()

  const afterRender = () => {
    const allRocks = Object.values(rocks()) as RockStore[]
    const allBullets = Object.values(bullets()).filter(
      ($b) => $b?.get().type === 'bullet'
    ) as BulletStore[]
    const allShips = Object.values(ships()).filter(
      ($s) => $s?.get().type === 'ship'
    ) as ShipStore[]

    const targets = new Set<TargetStore>(allRocks)
    const projectiles = new Set<ProjectileStore>(allBullets)

    // FIXME: include ships as targets
    // include ships as projectiles
    allShips.forEach(($s) => projectiles.add($s))

    // Manage collisions
    const collisionPartners = detectCollisions(targets, projectiles)

    if (collisionPartners.size > 0) {
      handleCollisionPartners(
        collisionPartners,
        gameActions,
        $scene.get().cameraContext ?? undefined
      )

      // maybe game over
      const $player = $game.get().$player
      if ($player != null) {
        const { alive, lives } = $player.get()
        if (!alive && lives <= 0) {
          gameActions.end()
        }
      }
    }
  }

  onAfterRender(afterRender)

  return (
    <>
      {/* Ship Collisions */}
      <For each={Object.keys(ships())}>
        {(id) => {
          const $ship = ships()[id]
          if ($ship == null) {
            return
          }
          // segments don't collide
          const segment = $ship.get().type === 'segment'
          if (segment) {
            return
          }
          return (
            <Collision id={'ship'} resolution={SHIP_RESOLUTION} store={$ship} />
          )
        }}
      </For>

      {/* Bullet Collisions */}
      <For each={Object.keys(bullets())}>
        {(id) => {
          const $bullet = bullets()[id]
          if ($bullet == null) {
            return
          }
          // explosions don't collide
          const explosion = $bullet.get().type === 'explosion'
          if (explosion) {
            return
          }
          return (
            <Collision id={id} resolution={BULLET_RESOLUTION} store={$bullet} />
          )
        }}
      </For>

      {/* Rock Collisions */}
      <For
        each={Object.values(rocks()).map(($r) => {
          const state = $r?.get()
          if (state == null) {
            return 'unknown'
          }
          return `${state.id ?? 'unknown'}_${state.size}`
        })}>
        {(key) => {
          const id = key.split('_')[0]
          const $rock = rocks()[id]
          if ($rock == null) {
            return
          }
          const { size } = $rock.get()
          return (
            <Collision
              id={id}
              resolution={
                size === ROCK_LARGE_SIZE
                  ? ROCK_LARGE_RESOLUTION
                  : size === ROCK_MEDIUM_SIZE
                  ? ROCK_MEDIUM_RESOLUTION
                  : ROCK_SMALL_RESOLUTION
              }
              store={$rock}
            />
          )
        }}
      </For>
    </>
  )
}
