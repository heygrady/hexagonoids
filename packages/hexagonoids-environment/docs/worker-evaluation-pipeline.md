# Worker Evaluation Pipeline

How worker-evaluator hydrates environments in workers and drives genome evaluation today. This doc reflects the current phase-11 seam:

- environment init-time configuration is delivered through `EnvironmentInitOptions`
- worker evaluation calls `environment.evaluate(executor, context)` or `evaluateAsync(...)`
- environments own their local execution-manager narrowing through `createExecutionManager`

---

## 1. Worker init

Each worker handles `INIT_EVALUATOR` once.

`handleInitEvaluator(...)` does four things:

1. Dynamically imports the algorithm package, environment factory, and executor factory.
2. Builds an `initOptions` object for the environment.
3. Merges `environmentRuntimeData` into that object.
4. Hydrates each pathname in `hydrateEnvironmentOptions` and stores the imported function under the requested field.

The worker then creates the environment once:

```ts
const initOptions: EnvironmentInitOptions = {}

if (environmentRuntimeData != null) {
  Object.assign(initOptions, environmentRuntimeData)
}

for (const [field, path] of Object.entries(hydrateEnvironmentOptions ?? {})) {
  const mod = await import(path)
  initOptions[field] = mod.default ?? mod[field]
}

const environment = createEnvironment(environmentData, initOptions)
```

At this point the worker has:

- a live environment instance
- algorithm factories for genome/config/state creation
- an executor factory

There is no follow-up runtime mutation step for the environment.

---

## 2. Per-genome evaluation

For each `REQUEST_EVALUATE_GENOME`, the worker:

1. creates a fresh bound evaluation context
2. hydrates the genome into an executor
3. registers that executor in the bound context for Lamarckian writeback correlation
4. calls the environment directly

Current shape:

```ts
const boundContext = createBoundContext({
  send: context.send,
  call: context.call,
  stats: context.stats,
  rng,
})

const { executor } = createCachedExecutorEntry(genomeFactoryOptions, context, {
  cache: false,
})

boundContext.executorMap.set(executor, 0)

const fitness = environment.isAsync
  ? await environment.evaluateAsync(executor, boundContext)
  : environment.evaluate(executor, boundContext)
```

After evaluation, the worker flushes writebacks and fitness callbacks from the bound context.

---

## 3. Environment contract

This is the only worker-facing environment contract that matters:

```ts
interface Environment<EFO = unknown> {
  evaluate(executor: StaticExecutor, context?: PartialEvaluationContext): number
  evaluateAsync(
    executor: StaticExecutor,
    context?: PartialEvaluationContext
  ): Promise<number>
}
```

`worker-evaluator` does not know about environment subtypes or environment-internal
helper methods. It only drives `evaluate(...)`.

---

## 4. Init-time runtime seam

The generic init-time seam is:

```ts
interface EnvironmentInitOptions<EMF, EMFO> {
  createExecutionManager?: EMF
  executionManagerFactoryOptions?: EMFO
  [key: string]: unknown
}
```

This is intentionally generic. The environment narrows it locally to the execution-manager shape it expects:

- supervised environments narrow to trainer factories
- step RL environments narrow to `StepAgentFactory`

The worker does not care which one it is. It only hydrates fields onto `initOptions`.

---

## 5. Current consumer pattern

A modern RL environment follows this pattern:

```ts
evaluate(executor: StaticExecutor, context?: PartialEvaluationContext): number {
  const createExecutionManager =
    this.initOptions?.createExecutionManager ?? createVanillaStepAgent
  const options = this.initOptions?.executionManagerFactoryOptions ?? {}
  const agent = createExecutionManager(executor, options, context)
  return this.evaluateStepAgent(agent, context)
}
```

Important details:

- the environment owns the fallback factory
- the environment owns the narrowing of `executionManagerFactoryOptions`
- the environment may have local helpers such as `evaluateStepAgent(...)`, but those are not part of the worker contract

Hexagonoids now follows this pattern.

---

## 6. Batch evaluation

`handleEvaluateBatch(...)` mirrors the same design:

- build one bound context for the batch
- hydrate all executors
- register each executor in `boundContext.executorMap`
- call `environment.evaluateBatch(executors, boundContext)` or `evaluateBatchAsync(...)`

The important point is the same as single evaluation: the context is passed as an argument to the environment method, not pushed by mutable runtime injection.

Whether a specific environment should support RL training in batch mode is a separate environment-level decision.

---

## 7. Boundary summary

The stable boundary is:

- `worker-evaluator` hydrates functions and config blobs into `EnvironmentInitOptions`
- the environment is constructed once with those init options
- each evaluation call receives a fresh `PartialEvaluationContext`
- the environment decides how to use `createExecutionManager`

That keeps the worker generic and keeps environment-specific routing inside the environment implementation where it belongs.
