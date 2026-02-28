# Scenario Generation

Training from frame 0 produces static evaluations with weak selection pressure. Scenario-based training replaces this with short evaluations starting from snapshots of game state captured just before player death, giving organisms immediate tactical challenges.

## Overview

The `generate-scenarios.js` script plays games with an agent, captures game state into a ring buffer every frame, and grabs the oldest buffered snapshot each time the player dies. This "rewinds" the state to ~60 frames before death, producing scenarios where rocks are nearby and the ship is under pressure.

Each snapshot is a plain JSON object (`ScenarioSnapshot`) containing the ship, player, all rocks, and all bullets at that moment. Snapshots are fully serializable and can be restored into a live `GameState` for evaluation.

Two modes are available:

- **Random mode** (default) — Uses `randomAgent` (random button presses). Fast, produces scenarios calibrated to random play.
- **Adversarial mode** — Trains a HyperNEAT agent first, then replays it to capture scenarios at moments before the *trained* agent dies. Produces scenarios that are genuinely challenging for evolved agents, enabling progressive improvement.

## Generate Scenarios

From repo root (requires a prior build):

```bash
# Build dependencies first
yarn turbo run build --filter='@heygrady/hexagonoids-demo...'

# Generate 100 scenarios with randomAgent (default)
node packages/hexagonoids-demo/scripts/generate-scenarios.js

# Quick test with fewer scenarios
node packages/hexagonoids-demo/scripts/generate-scenarios.js --count 10 --max-games 20
```

### CLI Options

| Flag | Default | Description |
|------|---------|-------------|
| `--mode <random\|adversarial>` | `random` | Generation mode |
| `--count <n>` | `100` | Number of scenarios to generate |
| `--seed <seed>` | `"scenario-gen"` | Base seed for deterministic generation |
| `--rewind <frames>` | `60` | Frames to rewind before each death (~2s at 33ms/frame) |
| `--max-games <n>` | `500` | Max games to play before stopping |
| `--output <path>` | `src/data/scenarios.json` | Output JSON file path |
| `--train-iterations <n>` | `100` | Training generations (adversarial only) |
| `--train-population <n>` | `64` | Population size (adversarial only) |

### Examples

```bash
# Large bank with custom seed (random mode)
node packages/hexagonoids-demo/scripts/generate-scenarios.js --count 500 --seed training-v1

# Wider rewind window (captures earlier state)
node packages/hexagonoids-demo/scripts/generate-scenarios.js --rewind 90

# Write to a custom location
node packages/hexagonoids-demo/scripts/generate-scenarios.js --output /tmp/scenarios.json

# Adversarial mode — trains a HyperNEAT agent, then replays it
node packages/hexagonoids-demo/scripts/generate-scenarios.js --mode adversarial --count 100 --seed adversarial-001

# Adversarial with custom training parameters
node packages/hexagonoids-demo/scripts/generate-scenarios.js --mode adversarial --train-iterations 200 --train-population 128
```

### Adversarial Mode

Adversarial mode runs in two phases:

1. **Train** — Shells out to the existing CLI to train a HyperNEAT agent with scenario-based evaluation. Training progress is printed to stdout. The best genome is saved to a temp directory.
2. **Replay** — Loads the trained genome, creates a `SyncExecutor`, and replays the agent using `neatAgent`. The same ring-buffer death-detection loop captures scenarios at moments before the trained agent dies.

Because the trained agent is competent at avoiding easy deaths, the resulting scenarios tend to involve more rocks, higher waves, and tighter tactical situations than random-mode scenarios.

## Output

The script writes a JSON array of `ScenarioSnapshot` objects and prints a summary:

```
Generated 100 scenarios in 5.23s

── Difficulty ──
  min=0.000  max=0.350  avg=0.085

── Waves ──
  wave 1: 12 scenarios
  wave 3: 28 scenarios
  wave 4: 35 scenarios
  wave 6: 25 scenarios

── Rocks per scenario ──
  min=4  max=55  avg=24.3
```

## Snapshot Format

Each `ScenarioSnapshot` contains:

| Field | Type | Description |
|-------|------|-------------|
| `version` | `1` | Schema version |
| `id` | `string` | Unique identifier |
| `difficulty` | `number` | 0–1, based on rocks within SOI at capture time |
| `gameTime` | `number` | Game clock (ms) when captured |
| `wave` | `number` | Current wave number |
| `ship` | `ScenarioShipState` | Position, velocity, yaw, alive status |
| `player` | `ScenarioPlayerState` | Score, lives, timestamps |
| `rocks` | `ScenarioRockState[]` | All rocks with position, velocity, size |
| `bullets` | `ScenarioBulletState[]` | All bullets with position, velocity |

All fields are plain JSON-serializable numbers, strings, and booleans.

## Difficulty Computation

Difficulty is computed on the captured snapshot by counting rocks within the sphere of influence (`SOI_ANGULAR_RADIUS * RADIUS` arc distance) of the ship's position, then normalizing by 20 and clamping to [0, 1].

## Using Scenarios in Training

Load the generated bank with `loadScenarioBank()` from `src/data/scenarios.ts`:

```typescript
import { loadScenarioBank } from './data/scenarios.js'

const scenarios = loadScenarioBank()
```

Evaluate an agent against a scenario with `simulateScenario`:

```typescript
import { simulateScenario } from '@heygrady/hexagonoids-environment'

const metrics = simulateScenario(
  agent,
  scenario,
  { maxTicks: 120 },  // short evaluation window
  'eval-seed'
)
```

This restores the snapshot into a live game state and runs the agent for 120 frames (default), returning the same `RawMetrics` structure as `simulateGame`.

## Determinism

- Same `--seed` produces identical scenarios
- Same snapshot + same eval seed + same agent produces identical `RawMetrics`
- The `resetIdCounter()` call in `restoreSnapshot` ensures deterministic entity IDs
