# Evaluation pipeline

How a genome goes from raw weights to a fitness score. This document traces the exact path through the code today, noting where the design diverges from common ML practices.

## The full chain

```
Genome
  → createPhenotype(genome)          # topological sort of the connection graph
  → createExecutor(phenotype)        # compile to typed-array forward pass
  → createNeatAgent()                # wrap executor in encode/decode loop
  → evaluateGauntlet(executor, seed) # run scenarios + full games + curriculum
  → blended fitness                  # weighted sum of episode scores
  → applyBehavioralGates(fitness)    # multiply by action/turn/throttle/bias gates
  → final fitness                    # what evolution sees
```

### 1. Phenotype creation

[`createPhenotype`](../../../../../hexagonoids-environment/../../neat-js/packages/neat/src/createPhenotype.ts) topologically sorts the genome's connection graph into an ordered list of `PhenotypeAction` tuples. Each action is either:
- `[Link, fromNode, toNode, weight]` — weighted connection
- `[Activation, node, bias, activationFn]` — apply activation function to a node

The `inputs` array maps external input channels to internal node indices. For vanilla NEAT this is identity: `inputs[i] = i`.

The `outputs` array maps output node indices in the values buffer: `outputs[i] = i + offset` where offset accounts for input + hidden nodes.

### 2. Executor compilation

[`createExecutor`](../../../../../executor/src/createExecutor.ts) pre-compiles the phenotype into parallel typed arrays for fast forward passes:

```ts
const values = new Float64Array(phenotype.length)  // node values buffer

// Forward pass:
values.fill(0)
for (i in inputs)  values[i] = externalInputs[phenotype.inputs[i]]
for (i in actions)  if (link) values[to] += values[from] * weight
                    if (activation) values[node] = fn(values[node] + bias)
for (i in outputs)  output[i] = values[phenotype.outputs[i]]
```

**Softmax groups**: if contiguous output nodes use `Activation.Softmax`, the executor normalizes them as a group after the forward pass. This is used by multi-discrete RL output modes, not by vanilla NEAT's sigmoid outputs.

### 3. Agent wrapper

[`createNeatAgent()`](../../../../hexagonoids-environment/src/agents/neatAgent.ts) creates a closure that:

1. Calls `encodeGameState(state, playerId, ...)` → 90-float input vector (see [inputs.md](./inputs.md))
2. Calls `executor.execute(inputs)` → 4-float output vector
3. Calls `decodeOutputs(outputs)` → `{ thrust, fire, left, right }` booleans

The `decodeOutputs` function thresholds each output at **0.75**:

```ts
// decodeOutputs.ts
const ACTIVATION_THRESHOLD = 0.75
thrust: outputs[0] > 0.75
fire:   outputs[1] > 0.75
left:   outputs[2] > 0.75   // with mutual-exclusion when both active
right:  outputs[3] > 0.75
```

### 4. Evaluation gauntlet

[`HexagonoidsEnvironment.evaluateGauntlet()`](../../../../hexagonoids-environment/src/HexagonoidsEnvironment.ts) runs three evaluation modes and blends results:

```ts
fitness = sw * scenarioFitness + fw * fullGameFitness + cw * curriculumFitness
return applyBehavioralGates(fitness, aggregatedFrames, gateConfig)
```

Each mode calls `simulateScenario` or `simulateGame`, which:
1. Create a game engine instance
2. Loop: encode → agent → decode → tick → collect metrics
3. Return `RawMetrics`
4. Score via `weightedFitnessSum(metrics, weights, gateConfig, context)`

### 5. Fitness scoring

See [fitness.md](./fitness.md) for the full formula. In short:

```
episodeFitness = (w_rocks × rocksNorm + w_accuracy × accuracyNorm) × survivalGate
finalFitness   = blendedEpisodeFitness × actionGate × turnGate × throttleGate × turnBiasGate
```

## Where things get muddled

### The activation threshold wall

With Sigmoid output activation (`Activation.Sigmoid`) and random initial weights, network outputs cluster around 0.5. The decode threshold is 0.75. This means:

- Most initial networks produce outputs below 0.75 for all channels
- These networks behave identically to doNothing — no thrust, fire, left, or right
- doNothing gets gated to ~0 fitness (turnGate=0.01, throttleGate=0.20)
- So most initial genomes score ~0 regardless of their weights

**The problem**: evolution sees a flat fitness landscape for the first few generations. There's no gradient between "slightly bad weights" and "terrible weights" — they all produce the same doNothing behavior and the same ~0 fitness. Evolution must randomly discover weights that push at least one output above 0.75, which happens through mutation drift rather than selection pressure.

**Standard practice comparison**: in typical neuroevolution, outputs are continuous values (e.g., steering angle, thrust magnitude) and fitness is a smooth function of those values. Even bad weights produce some behavior and some fitness gradient. Binary thresholding creates a step function that's invisible to selection.

### The gate cliff

Four multiplicative gates with a floor-then-multiply structure:

```
gatedFitness = rawFitness × max(actionGate, 0.6)
                           × max(turnGate, 0.01)
                           × max(throttleGate, 0.20)
                           × max(turnBiasGate, 0.01)
```

The worst case (no actions at all): `rawFitness × 0.6 × 0.01 × 0.20 × 1.0 = rawFitness × 0.0012`. Even a genome with perfect rock destruction gets crushed to near-zero if it doesn't turn or thrust.

**The problem**: to escape the gate cliff, a genome must simultaneously:
1. Push at least one output above 0.75 (escape doNothing)
2. Push _multiple_ outputs above 0.75 at different times (satisfy action diversity)
3. Push both left and right outputs above 0.75 at different times (satisfy turn gate)
4. Push thrust above 0.75 at some times (satisfy throttle gate)

This is a conjunctive requirement — all conditions must hold — but the gates don't provide gradient signal for partial success. A genome that thrusts perfectly but never turns scores 0.01× its performance, indistinguishable from a genome that does nothing.

**Standard practice comparison**: in typical RL/neuroevolution, behavioral shaping uses additive reward components (curiosity bonuses, action entropy bonuses) that provide gradient even for partial behavior. Multiplicative gates with near-zero floors are more like hard constraints than shaping signals.

### Input dimensionality vs initial topology

The encoding has 90 inputs. Vanilla NEAT starts with zero hidden nodes and direct input-to-output connections: 90 × 4 = 360 connections.

**The problem**: with 360 weights to tune and a flat fitness landscape (due to the threshold wall above), NEAT's mutation operators have a very large search space with very little signal. Adding hidden nodes (NEAT's structural mutations) makes this worse before it makes it better — more parameters, same flat landscape.

**Standard practice comparison**: neuroevolution with large input spaces typically uses either:
- Substrate-based methods (HyperNEAT, ES-HyperNEAT) that exploit input geometry
- Dimensionality reduction in the encoding
- Pre-trained or pre-structured initial topologies

Vanilla NEAT was designed for problems with ~10-20 inputs. At 90 inputs, the initial random search phase dominates training time.

### Observation: the "dead zone" at generation 0

Putting these together, generation 0 of a typical vanilla NEAT training run looks like:

1. 100 genomes created with random weights (centered around 0, stddev ~1)
2. After Sigmoid activation, outputs cluster around 0.5
3. All outputs below 0.75 threshold → all genomes behave as doNothing
4. All genomes get turnGate=0.01, throttleGate=0.20 → fitness ≈ 0
5. No selection pressure — all genomes are equally bad
6. Evolution proceeds by random drift until a mutation accidentally pushes an output above 0.75

This dead zone can last many generations. The `inspect fitness` tool's doNothing baseline shows exactly what this looks like: `gatedFitness: 0.0000`.

## What telemetry would reveal

The [phase-05 plan](../../../../../../.devnotes/lamarkian-neat/neat-quack/phase-05/plan.md) proposes structured telemetry for the evolution loop. With telemetry, you could directly measure:

- **Output distribution per generation**: what fraction of outputs exceed 0.75? When does this fraction start increasing?
- **Gate breakdown per generation**: which gate is the bottleneck? Is it always turnGate?
- **Fitness variance**: when does fitness variance become non-zero? (This marks the end of the dead zone)
- **Behavioral emergence timeline**: which action appears first (thrust? fire?) and how many generations until all 4 are present?

Without telemetry, you only see the final fitness number and have to guess where the signal is being lost. The inspect tools help diagnose a single evaluation, but they can't show the dynamics across generations.
