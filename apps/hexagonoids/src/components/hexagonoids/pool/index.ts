/**
 * Object Pool System
 *
 * A state-of-the-art object pooling system designed for Babylon.js v8 games.
 *
 * Key Features:
 * - Prevents disposal observer re-entry loops
 * - Separates mesh lifecycle from state lifecycle
 * - Deferred cleanup via disposal queue
 * - Re-entry guards on all operations
 * - Master mesh management for instances
 * - Comprehensive statistics and monitoring
 * @module pool
 */

export { DisposalQueue } from './DisposalQueue'
export type { MasterMeshFactory } from './MasterMeshManager'
export { MasterMeshManager } from './MasterMeshManager'
export { ObjectPool } from './ObjectPool'
export type { PoolConfig, PoolStats } from './PooledObject'
