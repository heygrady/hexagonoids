import type { GenomeFactoryConfig } from '@neat-evolution/worker-evaluator'

import type { ThreadInfo } from './ThreadInfo.js'

export interface ThreadContext {
  threadInfo?: ThreadInfo
  genomeFactoryConfig?: GenomeFactoryConfig
}
