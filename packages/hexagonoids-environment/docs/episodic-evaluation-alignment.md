# Episodic Evaluation Alignment

How hexagonoids evaluation works today, how the canonical loop works in neat-js, and how to close the gap.

---

## 1. The canonical loop (BanditEnvironment)

BanditEnvironment is the reference implementation. It implements `RuntimeConfigurable` so the worker can inject an agent factory and evaluation context at init time.

```
Worker init:
  environment.setRuntimeOptions({ createAgent, evaluationContext, agentFactoryOptions })

environment.evaluate(executor):
  factory = this.runtimeOptions?.createAgent ?? createVanillaAgent
  options = this.runtimeOptions?.agentFactoryOptions ?? {}
  agent   = factory(executor, options, this.runtimeOptions?.evaluationContext)
  return this.evaluateAgent(agent)

environment.evaluateAgent(agent: EpisodicAgent):
  for each episode:
    agent.startEpisode({ episodeIndex, type, metadata })
    for each step:
      outputs = agent.act(inputs)       // forward pass (+ rollout capture for RL agents)
      reward  = computeReward(outputs)
      agent.reward(reward, done)         // may trigger training segment
    agent.endEpisode({ fitness, episodeReturn, totalSteps, terminated })
  return averageFitness
```

Key properties:
- **`evaluate()` receives an executor.** The environment decides how to wrap it.
- **The agent factory is injected**, not hardcoded. Vanilla for NEAT, AC/QL for RL.
- **The episodic loop is environment-driven.** The environment calls `startEpisode`, `act`, `reward`, `endEpisode` in sequence.
- **No bridge/adapter needed.** The environment talks to `EpisodicAgent` directly.

---

## 2. How hexagonoids works today

### The wrapper stack

```
evaluate(executor):
  agent  = createVanillaAgent(executor, {})   // always vanilla, ignores injected factory
  bridge = createRLEpisodeBridge(agent)        // wraps EpisodicAgent in EpisodeAgentBridge
  evaluateGauntlet({ seed, bridge })

evaluateGauntlet({ seed, bridge }):
  evaluateFullGame(seed, frames, bridge, ...)
  evaluateScenarios(seed, frames, bridge, ...)
  evaluateCurriculum(seed, frames, bridge, ...)

evaluateFullGame(seed, frames, bridge, ...):
  simulateGame(bridge.agent, config, seed, runtime)

simulateGame(agent: AgentFn, ...):
  game loop:
    inputs = agent(state, playerId, context)  // encode → act → decode (inside bridge)
    engine.tick(inputs)
    if controller:
      controller.transitionInfo(info)         // calls setTransitionInfo?.() on the cast agent
      controller.reward(reward, done)
```

### The types at play

```
AgentFn = (state: GameState, playerId: string, context: AgentContext) => PlayerInputState
```

This is the game-engine contract. It takes raw game state and returns button presses. The game loop only needs this.

```
EpisodicAgent = { act, reward, startEpisode, endEpisode }
```

This is the RL contract from execution-manager. It takes Float64Array inputs and returns Float64Array outputs. It has episode lifecycle hooks.

```
EpisodeAgentBridge = { agent: AgentFn, startEpisode, reward, transitionInfo, endEpisode }
```

This is the hexagonoids-specific adapter. It:
1. Wraps `EpisodicAgent.act()` inside an `AgentFn` (encode game state → Float64Array → act → decode outputs → PlayerInputState)
2. Proxies episode lifecycle hooks through to the inner EpisodicAgent
3. Has a `transitionInfo()` method that casts to `TransitionAwareAgent` to call `setTransitionInfo?.()` — because `EpisodicAgent` doesn't have `setTransitionInfo` on its interface

### Problems

1. **`evaluate()` ignores the injected agent factory.** It always calls `createVanillaAgent(executor, {})`. This means RL agents (AC, QL) created by the worker's agent factory are never used. The worker pipeline would need to call `evaluateAgent()` directly, but that method also hardcodes `createRLEpisodeBridge(agent)`.

2. **The bridge duplicates what the environment should own.** The bridge does encoding + act + decoding, episode lifecycle proxying, and the `TransitionAwareAgent` cast. The environment should drive the episode lifecycle directly, like BanditEnvironment does.

3. **`TransitionAwareAgent` is a cast hack.** `setTransitionInfo` is defined on `ACAgent` and `QLAgent` (extensions of `EpisodicAgent`) but not on `EpisodicAgent` itself. The bridge casts to a union type and uses optional chaining. This works but it's fragile — the correct fix is either:
   - Add `setTransitionInfo` to `EpisodicAgent` in execution-manager (it's a reasonable method for any episodic agent to have), or
   - Have the environment check for the method at runtime without casting

4. **`AgentFn` couples the game engine to the evaluation system.** The game engine needs button presses. The evaluation system needs episodic lifecycle hooks. These two concerns are conflated in the bridge.

5. **Demo consumers create bridges manually.** `inspectFitness`, `analyzeGenomes`, `replayGenome`, `workerLabScript`, and `runtime` all do `createVanillaAgent → createRLEpisodeBridge → bridge.agent`. This should be internal to the environment.

---

## 3. Proposed alignment

### HexagonoidsEnvironment accepts init options via constructor

No `RuntimeConfigurable`, no `setRuntimeOptions`. Init options come through the factory at construction time and are immutable. See [worker-evaluation-pipeline.md](./worker-evaluation-pipeline.md) section 7.

```typescript
class HexagonoidsEnvironment implements Environment, EpisodicEnvironment {
  private readonly initOptions: EnvironmentInitOptions

  constructor(config: HexagonoidsEnvironmentConfig, initOptions?: EnvironmentInitOptions) {
    this.config = mergeConfig(config)
    this.initOptions = initOptions ?? {}
    // ...
  }
```

### evaluate() uses init options + evaluation context argument

Init options (agent factory, agentFactoryOptions) come through the constructor and are immutable. The evaluation context comes as an argument to `evaluate()` — see [worker-evaluation-pipeline.md](./worker-evaluation-pipeline.md) section 7 for the full rationale.

```typescript
evaluate(executor: StaticExecutor, rng?: RNG, context?: WorkerEvaluationContext): number {
  const factory = this.initOptions.createAgent ?? createVanillaAgent
  const options = this.initOptions.agentFactoryOptions ?? {}
  const agent = factory(executor, options, context)
  const seed = rng != null ? String(rng.gen()) : 'default-seed'
  return this.evaluateWithAgent(agent, seed)
}
```

This means:
- **Vanilla NEAT**: no agent factory in init options → `createVanillaAgent` → no-op lifecycle hooks, forward-only
- **AC/QL**: worker passes agent factory at init → creates ACAgent/QLAgent with rollout buffers and training
- **Evaluation context** flows through to the agent factory as the third argument — the environment never stores it

### The environment drives the episodic loop directly

```typescript
private evaluateWithAgent(agent: EpisodicAgent, seed: string): number {
  // The game agent wraps agent.act() for the game engine
  const gameAgent = this.createGameAgent(agent)

  // The environment drives the episode lifecycle — not the bridge
  const gauntlet = this.buildGauntlet(seed)
  for (const episode of gauntlet.episodes) {
    agent.startEpisode(episode.info)

    // simulateGame only needs the game agent + an afterTick hook
    // Reward computation and RL dispatch happen in the hook, not the game loop
    const metrics = episode.simulate(gameAgent, {
      onAfterTick: (state, engine) => {
        const reward = this.computeTickReward(state, ...)
        const terminated = isPlayerDead(state)
        const truncated = tick >= maxTicks - 1
        const transitionInfo = this.buildTransitionInfo(state, ...)

        agent.setTransitionInfo(transitionInfo)
        agent.reward(reward, terminated, truncated)
      }
    })

    agent.endEpisode(episode.buildResult(metrics))
  }
  return gauntlet.computeFitness()
}
```

### createGameAgent replaces the bridge's encoding/decoding role

```typescript
private createGameAgent(agent: EpisodicAgent): AgentFn {
  const floatInputs = new Float64Array(INPUT_COUNT)
  const observationBuffer = createObservationFrameBuffer()
  const seenRocks = new Set<string>()
  let inputBuffer: number[] | undefined

  return (state, playerId, context) => {
    // Encode game state → Float64Array
    inputBuffer = encodeGameState(state, playerId, inputBuffer, observationBuffer, ...)
    for (let i = 0; i < INPUT_COUNT; i++) {
      floatInputs[i] = inputBuffer[i] ?? 0
    }

    // Forward pass only — just calls act()
    const outputs = agent.act(floatInputs)

    // Decode outputs → button presses
    return selectDecoder(outputs.length)(outputs)
  }
}
```

This is the **only** adapter needed. It's a thin wrapper that:
1. Encodes game state to Float64Array (what the network expects)
2. Calls `agent.act()` (forward pass — act also records the transition for RL agents)
3. Decodes network outputs to button presses (what the game engine expects)

No episode lifecycle hooks. No reward proxying. No `TransitionAwareAgent` cast. Just encode → act → decode.

### simulateGame becomes a pure game loop

Reward computation and RL dispatch are environment concerns, not game loop concerns. The game loop ticks the engine and calls the game agent. After each tick it hands post-tick state back to the environment via a hook — the environment decides what to do with it (compute reward, check termination, call `agent.reward()`, build `TransitionInfo`).

```typescript
function simulateGame(
  gameAgent: AgentFn,
  config: SimulationConfig,
  seed: string,
  hooks?: {
    onAfterTick?(state: GameState, engine: GameEngine): void
  }
): RawMetrics {
  // Pure game loop — no reward computation, no RL awareness
  for (let tick = 0; tick < maxTicks; tick++) {
    const inputs = gameAgent(state, playerId, context)
    engine.tick(inputs, dtMs)

    // Environment does its thing: rewards, termination, transition info
    hooks?.onAfterTick?.(state, engine)
  }
  return collector.getMetrics(...)
}
```

The environment's `onAfterTick` handler closes over the `EpisodicAgent` and does all RL dispatch:

```typescript
// Inside the environment, when building the hook:
const onAfterTick = (state: GameState, engine: GameEngine) => {
  const reward = this.computeTickReward(state, prevState, rewardConfig)
  const terminated = isPlayerDead(state)
  const truncated = tick >= maxTicks - 1
  const transitionInfo = this.buildTransitionInfo(state, prevState)

  agent.setTransitionInfo(transitionInfo)
  agent.reward(reward, terminated, truncated)
}
```

The game loop never knows about rewards, done flags, or RL agents. It just runs the engine.

### Forward-only evaluation (no training)

For inspection/replay/analysis, you want to run a trained genome without RL training. This is just the default:

```typescript
// No agent factory injected → createVanillaAgent → forward-only
const fitness = environment.evaluate(executor)

// Or explicitly:
const forwardAgent = createVanillaAgent(executor, {})
const gameAgent = createGameAgent(forwardAgent)
simulateGame(gameAgent, config, seed)
```

The vanilla agent's `act()` calls `executor.forward()` — no backward pass, no rollout buffer, no training. Even if the executor is trainable, vanilla agent won't train it.

### Demo consumers simplify

Before:
```typescript
const executor = createExecutor(phenotype)
const episodicAgent = createVanillaAgent(executor, {})
const bridge = createRLEpisodeBridge(episodicAgent)
const metrics = simulateGame(bridge.agent, simConfig, seed)
```

After:
```typescript
const executor = createExecutor(phenotype)
const agent = createVanillaAgent(executor, {})
const gameAgent = createGameAgent(agent)
const metrics = simulateGame(gameAgent, simConfig, seed)
```

Or even simpler — if the environment owns `createGameAgent`, demo consumers can just call `environment.evaluate(executor)`.

---

## 4. What changes

| Today | Proposed |
|-------|----------|
| `EpisodeAgentBridge` wraps EpisodicAgent + proxies lifecycle | Environment drives lifecycle directly |
| `createRLEpisodeBridge()` does encoding + act + decoding + lifecycle | `createGameAgent()` does encoding + act + decoding only |
| `evaluate()` hardcodes `createVanillaAgent` | `evaluate()` uses init options factory + context arg |
| `TransitionAwareAgent` cast hack | `setTransitionInfo` added to `EpisodicAgent` interface (section 6) |
| `simulateGame` manages episode lifecycle via `SimulationEpisodeRuntime.controller` | `simulateGame` is a pure game loop with `onAfterTick` callback |
| Demo consumers manually create bridges | Demo consumers call `environment.evaluate()` or create game agents directly |
| `HexagonoidsEnvironment` ignores worker pipeline | Accepts init options in constructor, context on `evaluate()` |
| `RuntimeConfigurable` + `setRuntimeOptions` | Eliminated — init options in constructor, context on `evaluate()` |
| `doNothingAgent`/`randomAgent` are `AgentFn` (game-level) | Still `AgentFn` — used as game agents directly for baselines |

---

## 5. Three tiers of game agent

The game engine only ever sees `AgentFn` — `(state, playerId, context) => PlayerInputState`. Everything upstream is about how we construct the `EpisodicAgent` that feeds into `createGameAgent()`. There are three tiers, each adding a layer of capability:

### Tier 1: Static executor (deploy / replay / inspect)

```
StaticExecutor → createVanillaAgent(executor) → EpisodicAgent → createGameAgent(agent) → AgentFn
```

Forward-only. No training, no rollout buffer. `act()` calls `executor.forward()`. This is what the hexagonoids app uses to run a fully-trained genome in the browser, and what inspection/replay tools use.

```typescript
const executor = createExecutor(phenotype)
const agent = createVanillaAgent(executor, {})
const gameAgent = createGameAgent(agent)
// Use in game loop, simulateGame, etc.
```

### Tier 2: Trainable executor + RL agent (training evaluation)

```
TrainableExecutor → createACAgent(executor, config, rng) → ACAgent (EpisodicAgent) → createGameAgent(agent) → AgentFn
```

The agent factory (AC or QL) wraps the trainable executor in an RL agent with rollout buffers. `act()` does forward pass + records transition. `reward()` may trigger a backward pass. The environment drives the episode lifecycle and the RL agent trains within each evaluation.

This is what happens during worker evaluation when `evaluatorConfig.hydrateEnvironmentOptions.createAgent` points to `@neat-evolution/actor-critic/plugin`.

```typescript
// Worker-injected factory creates the RL agent:
const agent = createAgent(trainableExecutor, agentFactoryOptions, evaluationContext)
const gameAgent = createGameAgent(agent)
// Environment drives startEpisode → simulateGame(gameAgent, { onTick }) → endEpisode
```

With Lamarckian writeback, `evaluationContext.scheduleWriteback(executor)` is called by the agent factory at construction time. The trained weights persist back to the genome after evaluation.

### Tier 3: Trainable executor, forward-only (real-time inference without training)

```
TrainableExecutor → createVanillaAgent(executor) → EpisodicAgent → createGameAgent(agent) → AgentFn
```

Same as Tier 1 but with a trainable executor. The vanilla agent wraps it, so `act()` calls `executor.forward()` — no backward pass, no rollout buffer. This is useful for:
- Running a trainable executor without RL overhead (e.g., benchmarking forward-pass speed)
- Running the hexagonoids app with a genome that was trained with RL but deployed without it

The key insight: **the tier is determined by the agent factory, not the executor.** A trainable executor passed through `createVanillaAgent` behaves identically to a static executor. The RL capability comes from the agent wrapper (AC/QL), not from the executor itself.

### Composition principle

```
createGameAgent(agent: EpisodicAgent): AgentFn
```

This is the **only** hexagonoids-specific adapter. It does encode → `agent.act()` → decode. Everything below `EpisodicAgent` is generic neat-js infrastructure. Everything above `AgentFn` is game-engine infrastructure.

The three tiers differ only in what kind of `EpisodicAgent` you plug in:

| Tier | Agent factory | Executor | Training | Use case |
|------|--------------|----------|----------|----------|
| 1 | `createVanillaAgent` | `StaticExecutor` | None | Deploy, replay, inspect |
| 2 | `createACAgent` / `createQLAgent` | `TrainableExecutor` | Per-evaluation RL | Training pipeline |
| 3 | `createVanillaAgent` | `TrainableExecutor` | None (forward-only) | Inference with trainable model |

`doNothingAgent` and `randomAgent` don't go through this stack at all — they're raw `AgentFn` values that produce button presses without any neural network. They're baselines, not trained agents.

---

## 6. Decision: add setTransitionInfo to EpisodicAgent

`setTransitionInfo(info: TransitionInfo)` is currently only on `ACAgent` and `QLAgent`, not on `EpisodicAgent`. This forces hexagonoids to cast via `TransitionAwareAgent` to call it. Add it to the standard interface.

**Change in `@neat-evolution/execution-manager`:**

```typescript
export interface EpisodicAgent {
  act(inputs: Float64Array): Float64Array
  reward(reward: number, done: boolean): void
  startEpisode(info: EpisodeInfo): void
  endEpisode(result: EpisodeResult): void
  setTransitionInfo(info: TransitionInfo): void  // NEW
}
```

Vanilla agent gets a no-op implementation. AC and QL agents already implement it. Environments call it directly without casting.

This eliminates the `TransitionAwareAgent` cast hack in hexagonoids and aligns with how `TransitionInfo` is already modeled in `EpisodicContext` (which has `transitionInfo?()` as an optional hook). The difference is that `EpisodicContext` is for the plugin-provided context layer, while `setTransitionInfo` on the agent is the direct call the environment makes.

---

## 7. Gym alignment: terminated vs truncated

Our `reward(reward, done)` conflates Gymnasium's `terminated` and `truncated` into a single boolean. This affects value bootstrapping in the RL agents.

**Gymnasium convention (post-2022):**
```python
obs, reward, terminated, truncated, info = env.step(action)
```

- `terminated`: environment rule ended the episode (death, goal reached) → bootstrap value = 0
- `truncated`: time limit or external cutoff → bootstrap from V(s') because the state isn't terminal

**Our current interface:**
```typescript
agent.reward(reward: number, done: boolean)   // conflates both
```

**Problem for hexagonoids:** most episodes end by time limit (`tick >= maxTicks`), which is truncation. Death is termination. Both currently set `done=true`, so the training code uses bootstrap value = 0 for both — undervaluing positions near the time limit.

**Proposed change:**

```typescript
// EpisodicAgent
reward(reward: number, terminated: boolean, truncated: boolean): void

// Transition record
interface Transition {
  // ...
  terminated: boolean  // environment rule ended episode (death, goal)
  truncated: boolean   // time limit / external cutoff
}
```

Training code bootstraps correctly: `V(s') = 0` only when `terminated`, not when `truncated`.

This is a breaking change to `EpisodicAgent`, `EpisodicContext`, `Transition`, and all agent implementations (AC, QL, vanilla). It should be done alongside the `setTransitionInfo` addition — one interface revision.
