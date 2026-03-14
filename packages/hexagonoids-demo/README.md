# @heygrady/hexagonoids-demo

Headless training, inspection, and replay tooling for NEAT on hexagonoids.

## Commands

Build first, then run commands from the repo root:

```bash
yarn workspace @heygrady/hexagonoids-demo build
yarn workspace @heygrady/hexagonoids-demo demo --help
```

### Baseline

Scores `doNothingAgent` and `randomAgent` over a shared seed pack.

```bash
yarn workspace @heygrady/hexagonoids-demo demo baseline
```

Example with options:

```bash
yarn workspace @heygrady/hexagonoids-demo demo baseline \
  --evaluationSeedsPerOrganism 4 \
  --baseSeed session04-eval-v1 \
  --maxTicks 1500 \
  --dtMs 33
```

### Train

Runs evolution and writes artifacts (`best-*.json`, heroes log).

```bash
yarn workspace @heygrady/hexagonoids-demo demo train --method NEAT --profile default
```

Example with options:

```bash
yarn workspace @heygrady/hexagonoids-demo demo train \
  --method NEAT \
  --populationSize 64 \
  --iterations 90 \
  --earlyStopPatience 18 \
  --evaluationSeedsPerOrganism 4 \
  --baseSeed session04-train-v1 \
  --maxTicks 1500 \
  --dtMs 33 \
  --outputDir .artifacts/manual
```

### Replay

Loads a saved genome JSON and runs one simulation.

```bash
yarn workspace @heygrady/hexagonoids-demo demo replay \
  packages/hexagonoids-demo/.artifacts/session04/neat/best-NEAT.json \
  --method NEAT \
  --seed replay-1 \
  --maxTicks 1500 \
  --dtMs 33
```

`replay` is wired into the CLI correctly, but it is still an older feature and may fail if its underlying assumptions have drifted.

### Lab

```bash
yarn workspace @heygrady/hexagonoids-demo demo lab \
  --method NEAT \
  --name smoke-test \
  --profile default
```

### Inspect

```bash
yarn workspace @heygrady/hexagonoids-demo demo inspect inputs --seed debug-1 --agent random
yarn workspace @heygrady/hexagonoids-demo demo inspect fitness --genome ./path/to/genome.json --seed debug-1
```

### Scenarios

```bash
yarn workspace @heygrady/hexagonoids-demo demo scenarios \
  --output packages/hexagonoids-demo/src/data/scenarioBank.js \
  --seed scenario-refresh-1
```

### Help

```bash
yarn workspace @heygrady/hexagonoids-demo demo --help
```

### Benchmarking

```bash
yarn workspace @heygrady/hexagonoids-demo bench test/training.performance.bench.ts
```

Generate a CPU profile for flamegraph inspection:

```bash
node --cpu-prof ./node_modules/vitest/vitest.mjs bench --run \
  packages/hexagonoids-demo/test/training.flamegraph.bench.ts
```

## Entry points

- `@heygrady/hexagonoids-demo` and `@heygrady/hexagonoids-demo/browser` expose the browser-friendly demo API.
- `@heygrady/hexagonoids-demo/node` exposes node-specific helpers such as training, replay, persistence, and the programmatic CLI entry.
- `@heygrady/hexagonoids-demo/cli` exposes the programmatic CLI runner.
