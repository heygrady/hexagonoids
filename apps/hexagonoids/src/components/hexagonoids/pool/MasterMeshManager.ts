import type { InstancedMesh } from '@babylonjs/core/Meshes/instancedMesh'
import type { Mesh } from '@babylonjs/core/Meshes/mesh'
import type { Scene } from '@babylonjs/core/scene'

/**
 * Factory function to create a master mesh.
 */
export type MasterMeshFactory = (scene: Scene, type: string) => Mesh

/**
 * Manages shared master meshes for instanced rendering.
 *
 * In Babylon.js, instances share geometry and materials with a master mesh.
 * This manager ensures:
 * 1. Master meshes are created once and reused
 * 2. Masters outlive all their instances
 * 3. Masters are disposed only when manager is destroyed
 *
 * Usage:
 * ```typescript
 * const manager = new MasterMeshManager(scene, createBulletMaster)
 *
 * // Get or create master
 * const master = manager.getOrCreate('bullet')
 *
 * // Create instance
 * const instance = manager.createInstance('bullet', 'bullet_123')
 *
 * // Track instance
 * manager.trackInstance('bullet', instance)
 *
 * // Later, dispose instance (master remains)
 * instance.dispose()
 * manager.untrackInstance('bullet', instance)
 * ```
 */
export class MasterMeshManager {
  private readonly masters = new Map<string, Mesh>()
  private readonly instances = new Map<string, Set<InstancedMesh>>()
  private readonly scene: Scene
  private readonly factory: MasterMeshFactory
  private readonly name: string

  constructor(
    scene: Scene,
    factory: MasterMeshFactory,
    name = 'MasterMeshManager'
  ) {
    this.scene = scene
    this.factory = factory
    this.name = name
  }

  /**
   * Get an existing master mesh or create a new one.
   * @param {string} type - The type of master mesh (e.g., 'bullet', 'rock-large')
   * @returns {Mesh} The master mesh
   */
  getOrCreate(type: string): Mesh {
    let master = this.masters.get(type)
    if (master === undefined) {
      master = this.factory(this.scene, type)
      master.name = `${type}_master`
      master.isVisible = false // Masters should never be visible
      this.masters.set(type, master)
      this.instances.set(type, new Set())
    }

    return master
  }

  /**
   * Check if a master mesh exists.
   * @param {string} type - The type of master mesh
   * @returns {boolean} True if the master exists
   */
  has(type: string): boolean {
    return this.masters.has(type)
  }

  /**
   * Create an instance from a master mesh.
   * @param {string} type - The type of master mesh
   * @param {string} name - Name for the instance
   * @returns {InstancedMesh} A new instance of the master mesh
   */
  createInstance(type: string, name: string): InstancedMesh {
    const master = this.getOrCreate(type)
    const instance = master.createInstance(name)

    // Track this instance
    this.trackInstance(type, instance)

    return instance
  }

  /**
   * Track an instance manually (if created outside this manager).
   * @param {string} type - The type of master mesh
   * @param {InstancedMesh} instance - The instance to track
   */
  trackInstance(type: string, instance: InstancedMesh): void {
    let instances = this.instances.get(type)
    if (instances === undefined) {
      instances = new Set()
      this.instances.set(type, instances)
    }
    instances.add(instance)
  }

  /**
   * Stop tracking an instance (call when instance is disposed).
   * @param {string} type - The type of master mesh
   * @param {InstancedMesh} instance - The instance to untrack
   */
  untrackInstance(type: string, instance: InstancedMesh): void {
    this.instances.get(type)?.delete(instance)
  }

  /**
   * Get the number of tracked instances for a master.
   * @param {string} type - The type of master mesh
   * @returns {number} The number of tracked instances
   */
  getInstanceCount(type: string): number {
    return this.instances.get(type)?.size ?? 0
  }

  /**
   * Get all master mesh types.
   * @returns {string[]} Array of master mesh types
   */
  getMasterTypes(): string[] {
    return Array.from(this.masters.keys())
  }

  /**
   * Dispose of a specific master and all its instances.
   * Use with caution - typically only called during shutdown.
   * @param {string} type - The type of master mesh to dispose
   */
  disposeMaster(type: string): void {
    // Dispose all tracked instances first
    const instances = this.instances.get(type)
    if (instances !== undefined) {
      instances.forEach((instance) => {
        try {
          instance.dispose()
        } catch (error) {
          console.error(`[${this.name}] Error disposing instance:`, error)
        }
      })
      instances.clear()
    }

    // Dispose the master
    const master = this.masters.get(type)
    if (master !== undefined) {
      try {
        master.dispose()
      } catch (error) {
        console.error(`[${this.name}] Error disposing master:`, error)
      }
      this.masters.delete(type)
      this.instances.delete(type)
    }
  }

  /**
   * Dispose of all masters and instances.
   * Call this during shutdown to clean up resources.
   */
  disposeAll(): void {
    const types = Array.from(this.masters.keys())
    types.forEach((type) => {
      this.disposeMaster(type)
    })
  }

  /**
   * Get statistics about master mesh usage.
   * Useful for debugging and monitoring.
   * @returns {Record<string, { instanceCount: number; masterExists: boolean }>} Statistics object
   */
  getStats(): Record<string, { instanceCount: number; masterExists: boolean }> {
    const stats: Record<
      string,
      { instanceCount: number; masterExists: boolean }
    > = {}

    this.masters.forEach((master, type) => {
      stats[type] = {
        masterExists: !master.isDisposed(),
        instanceCount: this.getInstanceCount(type),
      }
    })

    return stats
  }
}
