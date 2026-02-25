import type { Component } from 'solid-js'

/**
 * Frustum culling for entity nodes.
 *
 * Previously read node references from nanostores to toggle visibility.
 * Now that entity nodes are managed by per-component pools, this component
 * is a placeholder. Babylon.js handles basic frustum culling automatically.
 * Custom culling can be re-added once a node registry is available.
 */
export const Culling: Component = () => {
  return null
}
