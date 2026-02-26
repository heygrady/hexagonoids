import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial'
import { Color3 } from '@babylonjs/core/Maths/math.color'
import type { Mesh } from '@babylonjs/core/Meshes/mesh'
import { TransformNode } from '@babylonjs/core/Meshes/transformNode'
import type { Scene } from '@babylonjs/core/scene'
import { latLngToVector3 } from '@heygrady/h3-babylon'
import { easeCubicIn } from 'd3-ease'
import { cellToLatLng } from 'h3-js'

import {
  CELL_CACHE_SIZE,
  CELL_VISITED_DURATION,
  CELL_VISITED_OPACITY,
  RADIUS,
} from '../constants'
import type { CellNodes } from '../engine/nodeTypes'
import type { NodeRegistry } from '../NodeRegistry'
import { ObjectPool } from '../pool/ObjectPool'
import { getYawPitch } from '../ship/getYawPitch'
import { moveNodeTo } from '../ship/orientation'
import { createCellPolygon } from './createCellPolygon'

interface CellData {
  h: string
  nodes: CellNodes
  visitedAt: number
}

/**
 * Imperative manager for H3 cell highlighting.
 * Owns a Map of active cells and an ObjectPool for node reuse.
 * Registers cells with the NodeRegistry for frustum culling.
 */
export class CellManager {
  private readonly activeCells = new Map<string, CellData>()
  private readonly pool: ObjectPool<CellNodes>
  private readonly scene: Scene
  private readonly globeNode: TransformNode
  private readonly registry: NodeRegistry

  constructor(scene: Scene, globeNode: TransformNode, registry: NodeRegistry) {
    this.scene = scene
    this.globeNode = globeNode
    this.registry = registry

    this.pool = new ObjectPool<CellNodes>({
      maxSize: CELL_CACHE_SIZE,
      name: 'CellPool',
      getScene: () => scene,
      createFn: (s) => this.createCellNodes(s, ''),
      resetFn: (nodes) => {
        nodes.originNode.setEnabled(false)
        if (nodes.cellNode != null) {
          nodes.cellNode.isVisible = false
          if (nodes.cellNode.material != null) {
            nodes.cellNode.material.alpha = CELL_VISITED_OPACITY
          }
        }
        return nodes
      },
      disposeFn: (nodes) => {
        if (nodes.cellNode != null) {
          nodes.cellNode.material?.dispose()
          nodes.cellNode.dispose()
        }
        nodes.positionNode.dispose()
        nodes.originNode.dispose()
      },
      keyFn: (nodes) => nodes.currentH,
    })
  }

  private createCellNodes(scene: Scene, h: string): CellNodes {
    const originNode = new TransformNode(`cell_origin_${h}`, scene)
    originNode.parent = this.globeNode

    const positionNode = new TransformNode(`cell_position_${h}`, scene)
    positionNode.parent = originNode
    positionNode.position.y = RADIUS

    let cellNode: Mesh | null = null
    if (h !== '') {
      // Position BEFORE creating mesh — createCellPolygon uses worldToLocal()
      // which needs the parent hierarchy's world matrix to be correct
      this.positionOnGlobe(originNode, h)
      positionNode.computeWorldMatrix(true)
      cellNode = this.createMesh(scene, positionNode, h)
    }

    return { originNode, positionNode, cellNode, currentH: h }
  }

  private createMesh(
    scene: Scene,
    positionNode: TransformNode,
    h: string
  ): Mesh {
    const mesh = createCellPolygon(scene, positionNode, h, RADIUS)
    const material = new StandardMaterial(`cellMaterial_${h}`, scene)
    material.diffuseColor = Color3.FromHexString('#999999')
    material.specularColor = Color3.Black()
    material.emissiveColor = Color3.Black()
    material.alpha = CELL_VISITED_OPACITY
    mesh.material = material
    return mesh
  }

  private positionOnGlobe(originNode: TransformNode, h: string): void {
    const [lat, lng] = cellToLatLng(h)
    const center = latLngToVector3(lat, lng, RADIUS)
    const [yaw, pitch] = getYawPitch(center)
    moveNodeTo(originNode, yaw, pitch)
  }

  private getOrCreateCell(h: string): CellNodes {
    // Try to acquire from pool with same key
    if (this.pool.has(h)) {
      const nodes = this.pool.acquire(h)
      nodes.originNode.setEnabled(true)
      if (nodes.cellNode != null) {
        nodes.cellNode.isVisible = true
      }
      return nodes
    }

    // Acquire any node from pool (or create new)
    const nodes = this.pool.acquire()

    // Unregister old key from culling if it was different
    if (nodes.currentH !== '' && nodes.currentH !== h) {
      this.registry.unregister(`cell:${nodes.currentH}`)
    }

    // If the pooled node had a different H3 cell, rebuild the mesh
    if (nodes.currentH !== h) {
      // Dispose old mesh and its material
      if (nodes.cellNode != null) {
        nodes.cellNode.material?.dispose()
        nodes.cellNode.dispose()
      }

      // Position on the globe for the new cell
      this.positionOnGlobe(nodes.originNode, h)
      nodes.positionNode.computeWorldMatrix(true)

      // Create new mesh
      nodes.cellNode = this.createMesh(this.scene, nodes.positionNode, h)
      nodes.currentH = h
    }

    nodes.originNode.setEnabled(true)
    if (nodes.cellNode != null) {
      nodes.cellNode.isVisible = true
    }
    return nodes
  }

  visitCell(h: string, now: number): void {
    let cell = this.activeCells.get(h)
    if (cell == null) {
      const nodes = this.getOrCreateCell(h)
      cell = { h, nodes, visitedAt: now }
      this.activeCells.set(h, cell)

      // Register with culling system
      if (nodes.cellNode != null) {
        this.registry.register(`cell:${h}`, {
          originNode: nodes.originNode,
          visualNode: nodes.cellNode,
        })
      }
    } else {
      cell.visitedAt = now
    }
  }

  update(now: number): void {
    const toRemove: string[] = []

    for (const [h, cell] of this.activeCells) {
      const elapsed = now - cell.visitedAt
      let alpha = 0

      if (elapsed < CELL_VISITED_DURATION) {
        alpha =
          (1 - easeCubicIn(elapsed / CELL_VISITED_DURATION)) *
          CELL_VISITED_OPACITY
      }

      if (alpha <= 0) {
        toRemove.push(h)
        continue
      }

      // Update the material alpha
      if (cell.nodes.cellNode != null) {
        const material = cell.nodes.cellNode.material
        if (material != null) {
          material.alpha = alpha
        }
      }
    }

    // Release expired cells back to pool
    for (const h of toRemove) {
      const cell = this.activeCells.get(h)
      if (cell != null) {
        this.registry.unregister(`cell:${h}`)
        this.pool.release(cell.nodes)
        this.activeCells.delete(h)
      }
    }
  }

  dispose(): void {
    // Unregister and release all active cells
    for (const [h, cell] of this.activeCells) {
      this.registry.unregister(`cell:${h}`)
      this.pool.release(cell.nodes)
    }
    this.activeCells.clear()
    this.pool.destroy()
  }
}
