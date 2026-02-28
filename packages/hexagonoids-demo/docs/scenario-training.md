# Scenario-Based Training

## Overview

Scenario-based training evaluates NEAT organisms against short, focused game
situations (snapshots) instead of full-length games. Each scenario captures a
moment just before a player death — the ship surrounded by rocks, mid-dodge,
etc. — and runs the agent for a limited number of ticks from that state.

### Why scenario training?

- **Faster evaluation**: 20 scenarios × 120 ticks = 2,400 total ticks vs 1,500+
  ticks for a single full game. Similar signal, less compute.
- **Denser signal**: Every scenario starts in a challenging situation. Full games
  spend many ticks in low-danger states where all agents perform equally.
- **Better coverage**: The scenario bank spans multiple waves, rock
  configurations, and difficulty levels. A single seed may not cover all cases.
- **Reduced variance**: Aggregating across 20 independent situations smooths out
  luck from individual rock spawns.

## Generating Scenarios

Scenarios are pre-generated from random-agent games and stored in
`src/data/scenarios.json`.

```bash
# Build dependencies first
yarn turbo run build --filter='@heygrady/hexagonoids-demo...'

# Generate 100 scenarios (default)
node packages/hexagonoids-demo/scripts/generate-scenarios.js

# Custom options
node packages/hexagonoids-demo/scripts/generate-scenarios.js \
  --count 200 \
  --seed my-seed \
  --rewind 60 \
  --max-games 500
```

The script plays games with a random agent, captures snapshots 60 frames before
each death, and writes them to `src/data/scenarios.json`. After regenerating,
rebuild the package to include the updated scenarios.

## Running Scenario Training

Use the `--scenarios` flag with the `train` command:

```bash
# Quick test
node packages/hexagonoids-demo/dist/esm/main.js train \
  --scenarios --iterations 3 --populationSize 16 --threadCount 1

# Full run
node packages/hexagonoids-demo/dist/esm/main.js train \
  --scenarios --iterations 90 --populationSize 64

# Custom scenario parameters
node packages/hexagonoids-demo/dist/esm/main.js train \
  --scenarios \
  --scenariosPerOrganism 30 \
  --scenarioMaxTicks 150 \
  --iterations 50
```

### CLI flags

| Flag                          | Default | Description                        |
| ----------------------------- | ------- | ---------------------------------- |
| `--scenarios`                 | off     | Enable scenario-based evaluation   |
| `--scenariosPerOrganism <n>`  | 20      | Number of scenarios per evaluation |
| `--scenarioMaxTicks <n>`      | 120     | Max ticks to simulate per scenario |

## A/B Experiments

Compare full-game and scenario training side-by-side:

```bash
# Default comparison (20 iterations, 64 population)
node packages/hexagonoids-demo/scripts/experiment-scenarios.js

# Custom comparison
node packages/hexagonoids-demo/scripts/experiment-scenarios.js \
  --iterations 10 \
  --population 32 \
  --method NEAT \
  --seeds-per 4 \
  --thread-count 4
```

The script runs both modes sequentially and prints a comparison table with best
fitness, population mean/median, elapsed time, and speed ratio.

## Configuration

### Environment config

The `HexagonoidsEnvironmentConfig.simulation` object includes:

| Field                   | Default | Description                              |
| ----------------------- | ------- | ---------------------------------------- |
| `scenariosPerOrganism`  | 20      | How many scenarios to sample per organism |
| `scenarioMaxTicks`      | 120     | Max ticks for each scenario simulation    |

The `scenarioBank` field on `HexagonoidsEnvironmentConfig` accepts an array of
`ScenarioSnapshot` objects. When set and non-empty, the environment
automatically uses scenario-based evaluation.

### Demo defaults

`DEMO_DEFAULTS` in `src/configDefaults.ts` provides matching defaults for the
training CLI.

## How Metrics Aggregation Works

When evaluating across multiple scenarios, metrics are aggregated as follows:

- **Summed**: `episodeReward`, `score`, `rocksDestroyed`, `shotsFired`,
  `shotsHit`, `deaths`, `distanceTraveled`, `thrustFrames`, `fireFrames`,
  `leftFrames`, `rightFrames`, `aliveFrames`, `framesWithRocksInSOI`,
  `largeRocksSpawned`, `uniqueRocksSeen`, `uniqueCellsVisited`, `wavesSpawned`,
  `timeAlive`
- **Recomputed**: `accuracy = totalShotsHit / totalShotsFired`
- **Min**: `livesRemaining` (worst-case across scenarios)

The survival gate uses the aggregate time budget
(`scenariosPerOrganism × scenarioMaxTicks × dtMs`) rather than per-scenario
`maxTicks`, so agents that survive all scenarios get full survival credit.

## Architecture Notes

The scenario bank is plain JSON and transfers cleanly via structured clone to
worker threads. `WorkerEvaluator` reconstructs environments in workers from
`toFactoryOptions()`, which includes the `scenarioBank` array. No file-path
indirection is needed — the data goes directly through the worker protocol.
