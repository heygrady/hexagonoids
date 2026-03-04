import type { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh'
import type { TransformNode } from '@babylonjs/core/Meshes/transformNode'
import { type Component, createContext, type JSX, useContext } from 'solid-js'

export interface CullableEntry {
  originNode: TransformNode
  visualNode: AbstractMesh
  /** Surface-level node (position.y = RADIUS). Only ships have a separate positionNode. */
  positionNode?: TransformNode
  /** Yaw-only node used by ships. */
  orientationNode?: TransformNode
  /** Optional ship tail mesh for thrust effects. */
  shipTailNode?: AbstractMesh
  /**
   * Set to true when a node is freshly acquired from the pool.
   * EntityVisualSync clears this after positioning and enabling the node,
   * preventing a one-frame flash at the origin.
   */
  needsInit?: boolean
}

/**
 * Registry of active entity nodes for custom frustum culling.
 *
 * Entity components register their origin + visual nodes on mount
 * and unregister on cleanup. The Culling component iterates the
 * registry each frame to toggle visibility based on the camera
 * bounding box.
 */
export class NodeRegistry {
  private readonly entries = new Map<string, CullableEntry>()

  register(key: string, entry: CullableEntry): void {
    this.entries.set(key, entry)
  }

  unregister(key: string): void {
    this.entries.delete(key)
  }

  get(key: string): CullableEntry | undefined {
    return this.entries.get(key)
  }

  values(): IterableIterator<CullableEntry> {
    return this.entries.values()
  }
}

const NodeRegistryContext = createContext<NodeRegistry>()

export const useNodeRegistry = (): NodeRegistry => {
  const context = useContext(NodeRegistryContext)
  if (context == null) {
    throw new Error(
      'useNodeRegistry: cannot find a NodeRegistryContext.Provider'
    )
  }
  return context
}

export interface NodeRegistryProviderProps {
  children?: JSX.Element
}

export const NodeRegistryProvider: Component<NodeRegistryProviderProps> = (
  props
) => {
  const registry = new NodeRegistry()

  return (
    <NodeRegistryContext.Provider value={registry}>
      {props.children}
    </NodeRegistryContext.Provider>
  )
}
