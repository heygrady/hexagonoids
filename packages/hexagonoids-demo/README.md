# @heygrady/hexagonoids-demo

Headless training and replay tooling for NEAT on hexagonoids.

## Commands

Run all commands from repo root:

```bash
yarn workspace @heygrady/hexagonoids-demo build
```

### Baseline mode (no evolution)

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

### Train mode

Runs evolution and writes artifacts (`best-*.json`, heroes log).

```bash
yarn workspace @heygrady/hexagonoids-demo demo train
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

Profiling example (writes per-process simulation stage timings as NDJSON):

```bash
yarn workspace @heygrady/hexagonoids-demo demo train \
  --method HyperNEAT \
  --populationSize 32 \
  --iterations 5 \
  --maxTicks 1000 \
  --dtMs 33 \
  --perfProfile \
  --perfProfileSampleEveryNGames 64 \
  --perfProfileOutput .artifacts/manual/perf-profile.ndjson
```

### Replay mode

Loads a saved genome JSON and runs one simulation.

```bash
yarn workspace @heygrady/hexagonoids-demo demo replay \
  --path packages/hexagonoids-demo/.artifacts/session04/neat/best-NEAT.json \
  --method NEAT \
  --seed replay-1 \
  --maxTicks 1500 \
  --dtMs 33
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

## Notes

- `baseline` and `train` share core numeric options (`--maxTicks`, `--dtMs`,
  `--evaluationSeedsPerOrganism`, `--baseSeed`, `--method`).
- `train` additionally accepts evolution options (`--populationSize`,
  `--iterations`, `--secondsLimit`, `--earlyStopPatience`, `--threadCount`,
  `--logInterval`, `--outputDir`, `--perfProfile`,
  `--perfProfileSampleEveryNGames`, `--perfProfileOutput`).
- `replay` uses replay-specific options (`--path`, `--method`, `--seed`,
  `--maxTicks`, `--dtMs`).
