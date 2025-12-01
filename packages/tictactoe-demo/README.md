# @heygrady/tictactoe-demo

A NEAT training pipeline and CLI for evolving neural network agents to play
Tic-Tac-Toe. This package provides ready-to-run training scripts, interactive
play against trained agents, and supports multiple neuroevolution methods
including NEAT, CPPN, HyperNEAT, ES-HyperNEAT, and DES-HyperNEAT.

Training uses worker threads for parallel genome evaluation and the Glicko-2
tournament strategy for competitive fitness assessment.

## Purpose

- **Training Pipeline**: Run complete NEAT evolution with configurable
  parameters
- **Interactive Play**: Test trained agents via command-line interface
- **Multiple Methods**: Support for NEAT, CPPN, HyperNEAT, ES-HyperNEAT, and
  DES-HyperNEAT
- **Worker Parallelization**: Leverage multiple CPU cores for faster training

## How it Fits into the Ecosystem

- **@heygrady/tictactoe-game**: Uses game logic and AI players for opponents and
  play
- **@heygrady/tictactoe-environment**: Creates the NEAT environment for genome
  evaluation
- **@heygrady/tournament-strategy**: Uses GlickoStrategy for tournament-based
  fitness
- **@neat-evolution/\***: Integrates with the full NEAT evolution ecosystem

## Installation

```bash
yarn add @heygrady/tictactoe-demo
```

## CLI Commands

### Training

```bash
# From the monorepo root
yarn demo

# Or from within the package
yarn workspace @heygrady/tictactoe-demo start
```

Training runs for up to 10,000 generations or 3 hours (configurable). Progress
is logged to the console, and the best genome is saved to `best-NEAT.json`.

### Interactive Play

```bash
# From the monorepo root
yarn play

# Or from within the package
yarn workspace @heygrady/tictactoe-demo play
```

Play against a trained agent in your terminal. You'll be prompted for moves
(1-9) and the AI will respond with its choices.

## Key Components

### Exported Classes

- **`EvolutionManager`**: High-level manager for running evolution with
  configuration
- **`InteractiveGame`**: Utilities for playing games with trained agents

### Training Configuration

The `train.ts` script configures:

- **Environment**: Game outcome scores, confidence multipliers, gauntlet
  opponents
- **Strategy**: Glicko-2 tournament settings, fitness weights, hero tracking
- **Evolution**: Population size, mutation rates, early stopping criteria
- **Method**: NEAT, CPPN, HyperNEAT, ES-HyperNEAT, or DES-HyperNEAT

## Usage

### Running Custom Training

```typescript
import {
  createEnvironment,
  type TicTacToeEnvironmentConfig,
} from "@heygrady/tictactoe-environment";
import { GlickoStrategy } from "@heygrady/tournament-strategy";
import { defaultNEATGenomeOptions, neat } from "@neat-evolution/neat";
import {
  NEATAlgorithm,
  WorkerEvaluator,
} from "@neat-evolution/worker-evaluator";

// 1. Configure environment
const environmentOptions: Partial<TicTacToeEnvironmentConfig> = {
  gameOutcomeScores: { win: 1, draw: 0.5, loss: -0.1 },
  gauntletOpponents: [
    { opponent: "minimaxAI", numGames: 5, weight: 0.33 },
    { opponent: "heuristicAI", numGames: 5, weight: 0.33 },
    { opponent: "sleeperAI", numGames: 25, weight: 0.34 },
  ],
};

const environment = createEnvironment(environmentOptions);

// 2. Configure tournament strategy
const strategy = new GlickoStrategy({
  matchPlayerSize: 2,
  individualSeeding: true,
  numSeedTournaments: 10,
  fitnessWeights: {
    seedWeight: 0.4, // Weight for AI opponent performance
    envWeight: 0.0,
    glickoWeight: 0.6, // Weight for tournament performance
    conservativeWeight: 0.0,
  },
});

// 3. Create evaluator with worker threads
const evaluator = new WorkerEvaluator(NEATAlgorithm, environment, {
  createEnvironmentPathname: "@heygrady/tictactoe-environment",
  createExecutorPathname: "@neat-evolution/executor",
  taskCount: 150,
  threadCount: 4,
  strategy,
});

// 4. Run evolution
const best = await neat(
  createReproducer,
  evaluator,
  { iterations: 1000, earlyStop: true },
  neatOptions,
  populationOptions,
  genomeOptions,
);

console.log(`Best fitness: ${best?.fitness}`);
```

### Loading and Using a Trained Agent

```typescript
import fs from "fs";

import { checkState, getInitialBoard, neatAI } from "@heygrady/tictactoe-game";
import { createExecutor } from "@neat-evolution/executor";
import {
  createConfig,
  createGenome,
  createPhenotype,
  createState,
} from "@neat-evolution/neat";

// 1. Load saved genome
const json = JSON.parse(fs.readFileSync("best-NEAT.json", "utf-8"));

// 2. Recreate executor from saved state
const executor = createExecutor(
  createPhenotype(
    createGenome(
      createConfig(json.genome.config),
      createState(json.genome.state),
      json.genome.genomeOptions,
      { inputs: 18, outputs: 9 },
      json.genome.factoryOptions,
    ),
  ),
);

// 3. Use the trained agent to play
let board = getInitialBoard();
const [newBoard, move, fitness] = neatAI(board, 1, {
  executor,
  verbose: true,
});

console.log(`AI chose move ${move + 1}`);
```

## Training Methods

| Method            | Description                              | Use Case                         |
| ----------------- | ---------------------------------------- | -------------------------------- |
| **NEAT**          | Direct encoding neural networks          | Fast training, simple networks   |
| **CPPN**          | Compositional pattern-producing networks | Pattern-based solutions          |
| **HyperNEAT**     | Indirect encoding via substrate          | Structured input/output geometry |
| **ES-HyperNEAT**  | Evolvable substrate geometry             | Adaptive network topology        |
| **DES-HyperNEAT** | Dynamic evolvable substrate              | Complex adaptive topologies      |

## Configuration Options

### Evolution Options

```typescript
{
  iterations: 10_000,        // Maximum generations
  secondsLimit: 10_800,      // 3 hour time limit
  earlyStop: true,           // Stop if fitness plateaus
  earlyStopPatience: 150,    // Generations without improvement
}
```

### Fitness Weights

```js
{
  seedWeight: 0.4,           // AI gauntlet performance
  envWeight: 0.0,            // Raw environment score
  glickoWeight: 0.6,         // Tournament rating
  conservativeWeight: 0.0,   // Conservative rating (rating - 2*RD)
}
```

## Output Files

- **`best-NEAT.json`**: Best genome from training (serialized)
- **`heroes-log.json`**: Historical best performers for hero tracking
- **`observed-ranges.json`**: Normalization range data for Glicko scoring

## License

MIT License - see [LICENSE](../../LICENSE) for details.
