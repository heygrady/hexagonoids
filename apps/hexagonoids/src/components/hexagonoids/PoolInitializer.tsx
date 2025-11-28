import type { Component } from 'solid-js'

import { useSceneStore } from '../solid-babylon/hooks/useScene'

import { initializeBulletPool } from './store/bulletPool/BulletPool'
import { initializeCellPool } from './store/cellPool/CellPool'
import { initializePlayerPool } from './store/playerPool/PlayerPool'
import { initializeRockPool } from './store/rockPool/RockPool'
import { initializeShipPool } from './store/shipPool/ShipPool'

/**
 * Initializes all object pools after the scene and globe are ready.
 * This component should be placed after the Globe component in the tree
 * to ensure scene and globe exist before pool initialization.
 *
 * Pools initialized:
 * - BulletPool (bullets and explosions)
 * - RockPool (rocks and debris) - TODO
 * - ShipPool (player ships) - TODO
 * - CellPool (H3 cells) - TODO
 * @returns {null} This component doesn't render anything
 */
export const PoolInitializer: Component = () => {
  const [$scene] = useSceneStore()

  const sceneState = $scene.get()
  const { scene, globe } = sceneState

  if (scene == null) {
    throw new Error('[PoolInitializer] Scene not available')
  }

  if (globe == null) {
    throw new Error('[PoolInitializer] Globe not available')
  }

  initializeBulletPool(scene, globe)
  initializeCellPool(scene, globe)
  initializePlayerPool(scene, globe)
  initializeRockPool(scene, globe)
  initializeShipPool(scene, globe)

  // This component doesn't render anything
  return null
}
