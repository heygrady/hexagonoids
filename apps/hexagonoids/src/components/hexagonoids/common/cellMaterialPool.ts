import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial'
import { Color3 } from '@babylonjs/core/Maths/math.color'
import type { Scene } from '@babylonjs/core/scene'
import { gridDisk } from 'h3-js'

import { CELL_VISITED_OPACITY } from '../constants'

/**
 * Material pool for cells that need individual opacity/transparency.
 *
 * Strategy:
 * - Maintain a pool of unique materials for cells within k-ring 3 of the camera
 * - Cells outside the k-ring share a single default material (they're far away)
 * - As camera moves, materials are recycled from cells leaving the k-ring
 *   to cells entering the k-ring
 *
 * This allows per-cell fading while maintaining instancing benefits for geometry.
 */

const KRING_SIZE = 5 // k-ring distance from camera
const POOL_SIZE = 61 // Enough materials for k-ring + buffer (k-ring 5 ≈ 61 cells)

let materialPool: StandardMaterial[] = []
const cellToMaterialMap = new Map<string, StandardMaterial>() // cell H3 address → material
let currentKRingCells = new Set<string>() // cells currently in k-ring
let defaultMaterial: StandardMaterial | null = null
let sceneRef: Scene | null = null

/**
 * Initialize the material pool for a scene.
 * @param {Scene} scene - The scene
 */
export const initializeCellMaterialPool = (scene: Scene): void => {
  if (sceneRef === scene && materialPool.length > 0) {
    return // Already initialized for this scene
  }

  sceneRef = scene
  materialPool = []
  cellToMaterialMap.clear()
  currentKRingCells.clear()

  // Create materials for the pool
  for (let i = 0; i < POOL_SIZE; i++) {
    const material = new StandardMaterial(`cellMaterial_pool_${i}`, scene)
    // Use white as default - color will be updated by CameraLighting
    material.diffuseColor = new Color3(1, 1, 1)
    material.alpha = CELL_VISITED_OPACITY
    materialPool.push(material)
  }

  // Create the default material for cells outside the k-ring
  defaultMaterial = new StandardMaterial('cellMaterial_default', scene)
  defaultMaterial.diffuseColor = new Color3(1, 1, 1)
  defaultMaterial.alpha = CELL_VISITED_OPACITY
}

/**
 * Update the k-ring of cells around the camera.
 * This should be called when the camera moves to a new cell.
 * @param {string} cameraCellH - The camera cell H3 address
 */
export const updateCellKRing = (cameraCellH: string): void => {
  if (sceneRef == null) {
    console.warn('Cell material pool not initialized')
    return
  }

  // Get the new k-ring cells
  const newKRingCells = new Set(gridDisk(cameraCellH, KRING_SIZE))

  // Release materials from cells no longer in k-ring
  const cellsToRemove: string[] = []
  cellToMaterialMap.forEach((_, cellH) => {
    if (!newKRingCells.has(cellH)) {
      cellsToRemove.push(cellH)
    }
  })

  cellsToRemove.forEach((cellH) => {
    cellToMaterialMap.delete(cellH)
  })

  // Assign materials to new cells entering the k-ring
  let nextPoolIndex = 0
  newKRingCells.forEach((cellH) => {
    if (!cellToMaterialMap.has(cellH) && nextPoolIndex < materialPool.length) {
      cellToMaterialMap.set(cellH, materialPool[nextPoolIndex])
      nextPoolIndex++
    }
  })

  currentKRingCells = newKRingCells
}

/**
 * Get the material for a cell.
 * Returns a unique material if the cell is in the k-ring, or the default material.
 * @param {string} cellH - H3 cell address
 * @returns {StandardMaterial | null} StandardMaterial for the cell, or null if not initialized
 */
export const getCellMaterial = (cellH: string): StandardMaterial | null => {
  const pooledMaterial = cellToMaterialMap.get(cellH)
  if (pooledMaterial != null) {
    return pooledMaterial
  }

  // If not in pool, return default material (for cells outside k-ring)
  return defaultMaterial
}

/**
 * Release a cell's material back to the pool for reuse.
 * @param {string} cellH - H3 cell address
 */
export const releaseCellMaterial = (cellH: string): void => {
  cellToMaterialMap.delete(cellH)
  // Material will be recycled when next cell enters k-ring
  if (currentKRingCells.has(cellH)) {
    currentKRingCells.delete(cellH)
  }
}

/**
 * Reset material opacity when reusing a cell from the pool.
 * @param {string} cellH - H3 cell address
 */
export const resetCellMaterial = (cellH: string): void => {
  const material = getCellMaterial(cellH)
  if (material != null) {
    material.alpha = CELL_VISITED_OPACITY
  }
}

/**
 * Update the diffuse color of all materials (e.g., when camera/lighting changes).
 * @param {Color3} color - Color3 object for diffuse color
 */
export const updateAllMaterialColors = (color: any): void => {
  materialPool.forEach((material) => {
    material.diffuseColor = color
  })
  if (defaultMaterial != null) {
    defaultMaterial.diffuseColor = color
  }
}

/**
 * Cleanup the material pool (disposal).
 */
export const disposeCellMaterialPool = (): void => {
  materialPool.forEach((material) => {
    material.dispose()
  })
  defaultMaterial?.dispose()

  materialPool = []
  cellToMaterialMap.clear()
  // materialInUse.clear()
  currentKRingCells.clear()
  defaultMaterial = null
  sceneRef = null
}
