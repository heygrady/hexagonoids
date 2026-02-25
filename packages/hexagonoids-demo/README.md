# @heygrady/hexagonoids-demo

Headless training and replay tooling for NEAT on hexagonoids.

## Commands

Run all commands from repo root:

```bash
yarn workspace @heygrady/hexagonoids-demo build
```

### Baseline mode (no evolution)

Scores `doNothingAgent`, `randomAgent`, and `seekDestroyAgent` over a shared
seed pack.

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
  --outputDir packages/hexagonoids-demo/.artifacts/manual
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

## Notes

- `baseline` and `train` share core numeric options (`--maxTicks`, `--dtMs`,
  `--evaluationSeedsPerOrganism`, `--baseSeed`, `--method`).
- `train` additionally accepts evolution options (`--populationSize`,
  `--iterations`, `--secondsLimit`, `--earlyStopPatience`, `--threadCount`,
  `--logInterval`, `--outputDir`).
- `replay` uses replay-specific options (`--path`, `--method`, `--seed`,
  `--maxTicks`, `--dtMs`).
