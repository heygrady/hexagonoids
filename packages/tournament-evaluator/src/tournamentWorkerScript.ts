import { handleInitGenomeFactory } from '@neat-evolution/worker-evaluator'

import { handleEvaluateMatch } from './worker/handleEvaluateMatch.js'
import { handleInitEvaluator } from './worker/handleInitEvaluator.js'
import { startWorker } from './worker/startWorker.js'

startWorker({
  handleInitEvaluator,
  handleInitGenomeFactory,
  handleEvaluateMatch,
})
