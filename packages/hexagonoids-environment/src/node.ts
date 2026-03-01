// Node-only exports — these import node:fs, node:path, node:worker_threads
// and must NOT be included in browser bundles.

export { createEnvironment } from './createEnvironment.js'
export { createSimulationProfiler } from './evaluation/nodePerfProfiler.js'
export type { GenerateScenariosOptions } from './scenarios/generateScenarios.js'
export { generateScenarios } from './scenarios/generateScenarios.js'
