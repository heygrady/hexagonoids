import { Quaternion, Vector3 } from '@babylonjs/core/Maths/math.vector'
import type { Mesh } from '@babylonjs/core/Meshes/mesh'
import type { Scene } from '@babylonjs/core/scene'
import { map } from 'nanostores'

import { BULLET_CACHE_SIZE } from '../../constants'
import { ObjectPool } from '../../pool'
import { defaultBulletState, type BulletState } from '../bullet/BulletState'
import type { BulletStore } from '../bullet/BulletStore'

/**
 * Reset a bullet for pooling.
 * Called when releasing back to pool.
 *
 * Strategy:
 * - Hide from scene (disable nodes)
 * - Reset state to default values
 * - Validate nodes (clear if disposed)
 * @param {BulletStore} $bullet - Bullet store to reset
 * @returns {BulletStore} Same bullet store
 */
const resetBullet = ($bullet: BulletStore): BulletStore => {
  const state = $bullet.get()
  const { bulletNode, originNode, id } = state

  // 1. Hide/Disable nodes
  if (bulletNode != null) {
    bulletNode.isVisible = false
  }
  if (originNode != null) {
    originNode.setEnabled(false)
    originNode.rotationQuaternion = Quaternion.Identity()
  }

  // 2. Validate nodes aren't disposed
  if (bulletNode?.isDisposed() === true) {
    console.warn(
      `[BulletPool] Bullet ${id} has disposed bulletNode, clearing reference`
    )
    $bullet.setKey('bulletNode', null)
  }
  if (originNode?.isDisposed() === true) {
    console.warn(
      `[BulletPool] Bullet ${id} has disposed originNode, clearing reference`
    )
    $bullet.setKey('originNode', null)
  }

  // 3. Reset state (preserve id and nodes)
  $bullet.setKey('type', 'bullet')
  $bullet.setKey('size', null)
  $bullet.setKey('angularVelocity', Vector3.Zero())
  $bullet.setKey('lat', 0)
  $bullet.setKey('lng', 0)
  $bullet.setKey('firedAt', null)
  $bullet.setKey('$ship', null)

  return $bullet
}

/**
 * Dispose of a bullet's Babylon.js resources.
 * Called during pool eviction.
 * @param {BulletStore} $bullet - Bullet store to dispose
 */
const disposeBulletNodes = ($bullet: BulletStore): void => {
  const { bulletNode, originNode } = $bullet.get()

  // Dispose inside-out: mesh → transform
  // Material is shared via master, don't dispose it
  if (bulletNode != null) {
    bulletNode.dispose(false, false) // Don't dispose material (shared)
  }
  if (originNode != null) {
    originNode.dispose()
  }

  // Clear references
  $bullet.setKey('bulletNode', null)
  $bullet.setKey('originNode', null)
}

/**
 * Counter for generating unique bullet IDs.
 */
let bulletIdCounter = 0

/**
 * Create a new bullet store for the pool.
 * @param {Scene} scene - Babylon.js scene (unused, kept for ObjectPool contract)
 * @param {Mesh | null} [globe] - Globe mesh (unused, kept for backward compatibility)
 * @returns {BulletStore} New bullet store with default state
 */
const createBulletStore = (scene: Scene, globe: Mesh | null = null) => {
  const id = `bullet-${bulletIdCounter++}`
  const $bullet = map<BulletState>({ ...defaultBulletState, id })
  return $bullet
}

/**
 * Bullet pool using ObjectPool.
 * Stores BulletStore nanostores directly.
 */
type BulletPool = ObjectPool<BulletStore>

/**
 * Global bullet pool instance.
 * Must be initialized via initializeBulletPool() before use.
 */
let globalBulletPool: BulletPool | null = null

/**
 * Initialize the global bullet pool.
 * Should be called once during game setup after scene and globe are created.
 * @param {Scene} scene - Babylon.js scene
 * @param {Mesh} globe - Globe mesh to parent bullets to
 */
export const initializeBulletPool = (scene: Scene, globe: Mesh): void => {
  if (globalBulletPool !== null) {
    console.warn('[BulletPool] Already initialized, skipping')
    return
  }

  globalBulletPool = new ObjectPool<BulletStore>({
    maxSize: BULLET_CACHE_SIZE,
    getScene: () => scene,
    name: 'BulletPool',
    createFn: (scene: Scene) => createBulletStore(scene, globe),
    resetFn: resetBullet,
    disposeFn: disposeBulletNodes,
    keyFn: ($bullet) => $bullet.get().id ?? 'unknown',
  })
}

/**
 * Retrieve a bullet from the pool, or create a new one.
 * Returns a BulletStore (nanostore).
 * Pool must be initialized via initializeBulletPool() first.
 * @returns {BulletStore} Bullet store ready for configuration
 */
export const getBulletStore = (): BulletStore => {
  if (globalBulletPool === null) {
    throw new Error(
      '[BulletPool] Not initialized - call initializeBulletPool(scene, globe) first'
    )
  }
  return globalBulletPool.acquire()
}

/**
 * Release a bullet back into the pool.
 * @param {BulletStore} $bullet - Bullet store to release
 */
export const releaseBulletStore = ($bullet: BulletStore): void => {
  if (globalBulletPool === null) {
    throw new Error('[BulletPool] Cannot release bullet: pool not initialized')
  }
  globalBulletPool.release($bullet)
}

/**
 * Destroy the bullet pool.
 * Call during shutdown to clean up all resources.
 */
export const destroyBulletPool = (): void => {
  if (globalBulletPool !== null) {
    globalBulletPool.destroy()
    globalBulletPool = null
  }
}

/**
 * Get bullet pool statistics.
 * Useful for debugging and monitoring.
 * @returns {object | null} Pool statistics or null if not initialized
 */
export const getBulletPoolStats = () => {
  return globalBulletPool?.getStats() ?? null
}

/**
 * Make a bullet visible in the scene.
 * Should be called after positioning the bullet.
 * @param {BulletStore} $bullet - The bullet to show
 */
export const showBullet = ($bullet: BulletStore): void => {
  const { originNode, bulletNode, id } = $bullet.get()

  if (originNode == null || bulletNode == null) {
    console.error(
      `[BulletPool] Cannot show bullet ${id}: originNode=${
        originNode != null
      }, bulletNode=${bulletNode != null}`
    )
    return
  }

  bulletNode.isVisible = true
  bulletNode.setEnabled(true) // ObjectPool disables it, so we must enable it
  originNode.setEnabled(true)
}

/**
 * Hide a bullet from the scene.
 * Called during activation/deactivation/release.
 * @param {BulletStore} $bullet - The bullet to hide
 */
export const hideBullet = ($bullet: BulletStore): void => {
  const { originNode, bulletNode } = $bullet.get()

  if (originNode == null && bulletNode == null) {
    return // Nothing to hide
  }

  if (bulletNode != null) {
    bulletNode.isVisible = false
  }

  if (originNode != null) {
    originNode.setEnabled(false)
    originNode.rotationQuaternion = Quaternion.Identity()
  }
}
