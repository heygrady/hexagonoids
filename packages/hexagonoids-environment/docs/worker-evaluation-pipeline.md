# Worker Evaluation Pipeline

How worker-evaluator hydrates environments in workers and drives genome evaluation. The source of truth for how environments receive runtime configuration.

---

## 1. The two-phase lifecycle

Environment setup happens in two phases, both inside the worker thread.

### Phase 1: Worker init (once per worker)

The main thread broadcasts `INIT_EVALUATOR` with all configuration. Each worker runs `handleInitEvaluator`:

```
handleInitEvaluator(payload, threadContext):
  // 1. Dynamic imports from pathnames
  { createConfig, createGenome, createPhenotype, createState } = import(algorithmPathname)
  { createEnvironment } = import(createEnvironmentPathname)
  { createExecutor } = import(createExecutorPathname)

  // 2. Build base runtime options (persists across evaluations)
  runtimeOptions: EnvironmentRuntimeOptions = {}

  if statsConfig:
    runtimeOptions.stats = createWorkerStatsRecorder(statsConfig, sendToMain)

  // 3. Merge serializable blobs (config objects, agentFactoryOptions, etc.)
  Object.assign(runtimeOptions, environmentRuntimeData)

  // 4. Hydrate pathnames → live functions
  for [field, path] of hydrateEnvironmentOptions:
    mod = import(path)
    runtimeOptions[field] = mod.default ?? mod[field]
  // e.g., runtimeOptions.createAgent = imported agent factory

  // 5. Create environment — factory receives runtimeOptions as 2nd arg
  environment = createEnvironment(environmentData, runtimeOptions)

  // 6. Store for phase 2
  threadContext.threadInfo = { environment, createExecutor, ... }
  threadContext.baseRuntimeOptions = runtimeOptions
```

After this, the worker has:
- A live `environment` instance
- A `baseRuntimeOptions` object containing `stats`, `createAgent`, `agentFactoryOptions`, and any other hydrated fields
- Factory functions for genomes and executors

### Phase 2: Per-genome evaluation (once per genome per generation)

The main thread dispatches `REQUEST_EVALUATE_GENOME`. The worker runs `handleEvaluateGenome`:

```
handleEvaluateGenome(payload, threadContext):
  { environment } = threadContext.threadInfo

  // 1. Create a fresh BoundContext for this evaluation
  boundContext = createBoundContext({ send, call, stats })
  //   implements WorkerEvaluationContext:
  //     send(message)            — fire-and-forget to main thread
  //     call<R>(message)         — RPC to main thread
  //     scheduleWriteback(exec)  — mark executor for Lamarckian writeback
  //     onFitness(callback)      — cleanup hook
  //     executorMap              — executor → index mapping

  // 2. Hydrate genome → executor
  executor = createCachedExecutorEntry(genomeFactoryOptions, context)
  boundContext.executorMap.set(executor, 0)

  // 3. Push per-genome runtime options
  if isRuntimeConfigurable(environment):
    environment.setRuntimeOptions({
      ...threadContext.baseRuntimeOptions,   // ← agent factory, agentFactoryOptions, stats
      evaluationContext: boundContext,        // ← fresh per-genome context
    })

  // 4. Evaluate
  fitness = environment.evaluate(executor, rng)

  // 5. Extract side effects
  writebacks = boundContext.flush()          // Lamarckian weight updates
  boundContext.fireFitnessCallbacks(fitness)  // cleanup hooks

  return { fitness, updatedActions? }
```

---

## 2. How the environment receives configuration

There are **two delivery mechanisms** and they happen at different times:

### Mechanism A: Factory argument (init time)

```typescript
type EnvironmentFactory<EFO> = (
  options: EFO,                                  // environment-specific config
  runtimeOptions?: EnvironmentRuntimeOptions     // runtime hooks + factories
) => Environment<EFO>
```

`handleInitEvaluator` calls `createEnvironment(environmentData, runtimeOptions)`. The factory can pass `runtimeOptions` into the constructor:

```typescript
// How BanditEnvironment's factory could work:
export const createEnvironment: EnvironmentFactory<BanditFactoryOptions> = (options, runtimeOptions) => {
  const env = new BanditEnvironment(options.outputCount)
  if (runtimeOptions) env.setRuntimeOptions(runtimeOptions)
  return env
}
```

This is a **one-time** setup. The `runtimeOptions` at init time contain everything from `hydrateEnvironmentOptions` and `environmentRuntimeData` — including `createAgent` and `agentFactoryOptions`. But they do **not** contain `evaluationContext` yet — that's per-genome.

### Mechanism B: setRuntimeOptions (per-genome)

```typescript
interface RuntimeConfigurable {
  setRuntimeOptions(options: EnvironmentRuntimeOptions): void
}
```

`handleEvaluateGenome` calls `environment.setRuntimeOptions({ ...baseRuntimeOptions, evaluationContext: boundContext })` before every `evaluate()` call. This merges the base options (from init) with a fresh `evaluationContext` for this specific genome evaluation.

The `evaluationContext` (a `WorkerEvaluationContext`) is what provides:
- `scheduleWriteback(executor)` — Lamarckian writeback
- `send(message)` / `call<R>(message)` — worker ↔ main thread RPC
- `stats` — metrics recording
- `executorMap` — executor correlation for writebacks

### The problem with two mechanisms

The factory argument and `setRuntimeOptions` deliver overlapping content. `baseRuntimeOptions` is built once at init and re-delivered on every `setRuntimeOptions` call, merged with the fresh `evaluationContext`. This means:

1. The environment sees `createAgent` twice — once via factory arg, once via `setRuntimeOptions`
2. `setRuntimeOptions` is called N times per generation (once per genome), but only `evaluationContext` changes
3. The environment stores mutable runtime state that gets overwritten before every evaluation
4. `RuntimeConfigurable` exists solely to support this pattern — extra interface plumbing on every environment

The fix is in section 7: init options go through the constructor, evaluation context goes on `evaluate()`. `RuntimeConfigurable` goes away.

---

## 3. What the environment does with it

BanditEnvironment shows the canonical pattern:

```typescript
class BanditEnvironment implements Environment, EpisodicEnvironment, RuntimeConfigurable {
  private runtimeOptions?: EnvironmentRuntimeOptions

  setRuntimeOptions(options: EnvironmentRuntimeOptions): void {
    this.runtimeOptions = options
  }

  evaluate(executor: StaticExecutor): number {
    // Get agent factory from runtime options (injected at init)
    const factory = this.runtimeOptions?.createAgent ?? createVanillaAgent
    const options = this.runtimeOptions?.agentFactoryOptions ?? {}

    // Create agent — factory receives evaluationContext (injected per-genome)
    const agent = factory(executor, options, this.runtimeOptions?.evaluationContext)

    // Agent is fully configured: vanilla for NEAT, AC/QL for RL
    return this.evaluateAgent(agent)
  }
}
```

The agent factory (e.g., `@neat-evolution/actor-critic/plugin`) receives the `evaluationContext` and uses it to:
- Call `context.scheduleWriteback(executor)` for Lamarckian training
- Attach telemetry via `context.stats`
- Wire up `onFitness` callbacks

---

## 4. Hexagonoids today vs. the canonical pattern

### Hexagonoids `createEnvironment`

```typescript
export const createEnvironment: EnvironmentFactory<...> = (options) => {
  const config = mergeConfig(options)
  return new HexagonoidsEnvironment(config)
}
```

**Problem:** Ignores the `initOptions` second argument entirely. Even if the worker passes init options, they're dropped on the floor.

### Hexagonoids `HexagonoidsEnvironment`

Does not accept init options. Has no agent factory. In `evaluate()`, it hardcodes `createVanillaAgent(executor, {})` — ignoring any injected agent factory. RL agents created by the worker pipeline have no way in.

### BanditEnvironment (current)

Uses `RuntimeConfigurable` + `setRuntimeOptions` to receive init options and per-genome context as a blended bag. Works end-to-end but with the re-delivery hack described in section 7.

---

## 5. Batch evaluation gap

`handleEvaluateBatch` creates a `BoundContext` and hydrates executors, but does **not** call `setRuntimeOptions` before `evaluateBatch()`. This means:

- Batch evaluation doesn't inject `evaluationContext` per-batch
- RL agent factories won't receive the evaluation context
- Lamarckian writeback won't work in batch mode

This is likely intentional for tournament-style batch evaluation (tictactoe) where RL training doesn't apply. But it's a gap to be aware of if hexagonoids ever uses batch evaluation with RL.

---

## 6. The full call chain

### Current (with setRuntimeOptions hack)

```
Worker thread:
  handleEvaluateGenome(payload, threadContext)
    → boundContext = createBoundContext(...)
    → executor = createCachedExecutorEntry(...)
    → environment.setRuntimeOptions({ ...base, evaluationContext: boundContext })   ← re-delivers init options
    → fitness = environment.evaluate(executor, rng)
      → agent = createAgent(executor, options, evaluationContext)                   ← env pulls context from mutable state
      → evaluateAgent(agent)
    → writebacks = boundContext.flush()
    → return { fitness, updatedActions }
```

### Proposed (context on evaluate)

```
Worker thread:
  handleEvaluateGenome(payload, threadContext)
    → boundContext = createBoundContext(...)
    → executor = createCachedExecutorEntry(...)
    → fitness = environment.evaluate(executor, rng, boundContext)                   ← context is an argument
      → agent = this.initOptions.createAgent(executor, options, boundContext)       ← env uses init options + eval context
      → evaluateAgent(agent)
    → writebacks = boundContext.flush()
    → return { fitness, updatedActions }
```

No `setRuntimeOptions`. No re-delivery. No mutation.

---

## 7. Decision: eliminate RuntimeConfigurable, pass context on evaluate()

### The problem

`setRuntimeOptions` exists to thread `evaluationContext` into the environment per-genome. But it re-delivers the entire init bag every time, and it requires mutable state on the environment. This is a hack. Init-time options and per-evaluation context are different lifetimes:

| Concern | Lifetime | Delivery |
|---------|----------|----------|
| `createAgent` | Environment lifetime (set at init) | Factory 2nd arg → constructor |
| `agentFactoryOptions` | Environment lifetime (set at init) | Factory 2nd arg → constructor |
| `stats` | Environment lifetime (set at init) | Factory 2nd arg → constructor |
| `evaluationContext` | Single `evaluate()` call | Should be an argument to `evaluate()` |

### The fix

**1. Init options come through the factory and stay in the constructor.**

```typescript
type EnvironmentFactory<EFO> = (
  options: EFO,
  initOptions?: EnvironmentInitOptions      // renamed from EnvironmentRuntimeOptions
) => Environment<EFO>
```

```typescript
interface EnvironmentInitOptions {
  stats?: StatsRecorder
  createAgent?: AgentFactory
  agentFactoryOptions?: AgentFactoryOptions
  [key: string]: unknown                    // hydrated pathnames
}
```

The environment stores these immutably:

```typescript
class HexagonoidsEnvironment {
  private readonly initOptions: EnvironmentInitOptions

  constructor(config: HexagonoidsEnvironmentConfig, initOptions?: EnvironmentInitOptions) {
    this.config = mergeConfig(config)
    this.initOptions = initOptions ?? {}
  }
}
```

**2. Evaluation context is an argument to `evaluate()`.**

```typescript
interface Environment<EFO = unknown> {
  evaluate(executor: StaticExecutor, rng?: RNG, context?: WorkerEvaluationContext): number
  evaluateAsync(executor: StaticExecutor, rng?: RNG, context?: WorkerEvaluationContext): Promise<number>
  // ...
}
```

The environment passes it through to the agent factory:

```typescript
evaluate(executor: StaticExecutor, rng?: RNG, context?: WorkerEvaluationContext): number {
  const factory = this.initOptions.createAgent ?? createVanillaAgent
  const options = this.initOptions.agentFactoryOptions ?? {}
  const agent = factory(executor, options, context)
  // ...
}
```

**3. `RuntimeConfigurable` goes away.**

No `setRuntimeOptions`. No mutable runtime state. No re-delivery of init options. The worker simplifies to:

```typescript
// handleInitEvaluator — once per worker
environment = createEnvironment(environmentData, initOptions)

// handleEvaluateGenome — once per genome
boundContext = createBoundContext(...)
fitness = environment.evaluate(executor, rng, boundContext)
```

**4. `baseRuntimeOptions` on ThreadContext goes away.**

The worker no longer needs to store and re-merge base options. Init options are in the environment. The bound context is a direct argument.

### What this changes in neat-js

- `Environment.evaluate()` signature gains optional `context` parameter
- `EnvironmentFactory` second arg renamed from `runtimeOptions` to `initOptions`
- `EnvironmentRuntimeOptions` split into `EnvironmentInitOptions` (init-time) — `WorkerEvaluationContext` is already its own type
- `RuntimeConfigurable` interface deleted
- `isRuntimeConfigurable` guard deleted
- `handleEvaluateGenome` drops the `setRuntimeOptions` call, passes `boundContext` to `evaluate()`
- `handleEvaluateBatch` can optionally pass `boundContext` to `evaluateBatch()` — closing the batch gap from section 5
- `BanditEnvironment` drops `implements RuntimeConfigurable`, stores init options in constructor, reads `context` from `evaluate()` arg
- `ThreadContext.baseRuntimeOptions` field deleted
