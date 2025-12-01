# @heygrady/tictactoe-environment

A NEAT environment adapter for training neural network agents to play Tic-Tac-Toe. This package implements the `@neat-evolution/environment` interface, providing evaluation methods for both individual genomes (gauntlet matches against AI) and head-to-head matches between genomes.

The environment includes configurable scoring based on game outcomes, move confidence, and player position (first vs second), enabling nuanced fitness evaluation beyond simple win/loss counting.

## Purpose

- **NEAT Integration**: Implement the `Environment` interface for use with `@neat-evolution` training systems
- **Gauntlet Evaluation**: Test genomes against multiple AI opponents (minimax, heuristic, random)
- **Head-to-Head Matches**: Evaluate pairs of genomes playing against each other
- **Configurable Scoring**: Fine-tune fitness calculation with outcome weights, confidence multipliers, and position bonuses

## How it Fits into the Ecosystem

- **@heygrady/tictactoe-game**: Uses game logic and AI players from this package
- **@heygrady/tournament-strategy**: Works with evaluation strategies to run tournaments
- **@heygrady/tictactoe-demo**: Creates and configures this environment for training runs
- **@neat-evolution/environment**: Implements the standard environment interface

## Installation

```bash
yarn add @heygrady/tictactoe-environment
```

## Key Components

### Classes

- **`TicTacToeEnvironment`**: Main environment class implementing `Environment<TicTacToeEnvironmentConfig>`

### Factory Functions

- **`createEnvironment(options?)`**: Factory function for creating environment instances (useful for worker threads)

### Configuration Types

- **`TicTacToeEnvironmentConfig`**: Complete environment configuration
- **`GameOutcomeScores`**: Base scores for win/loss/draw outcomes
- **`ConfidenceMultiplierConfig`**: Min/max multipliers based on move confidence
- **`PositionWeights`**: Weights for first-player vs second-player positions
- **`MoveWeightingConfig`**: Strategy for weighting moves by game position

### Scoring Utilities

- **`calculateNormalizationBounds()`**: Compute score normalization ranges
- **`calculateOpponentNormalizationBounds()`**: Opponent-specific normalization based on expected difficulty

## Usage

### Basic Environment Setup

```typescript
import {
  TicTacToeEnvironment,
  type TicTacToeEnvironmentConfig,
} from '@heygrady/tictactoe-environment'

// 1. Create environment with default configuration
const environment = new TicTacToeEnvironment()

// 2. Or customize the configuration
const customEnvironment = new TicTacToeEnvironment({
  gameOutcomeScores: {
    win: 1.0,
    loss: 0.1,
    draw: 0.33,
  },
  confidenceMultiplier: {
    min: 0.5, // Penalty for uncertain moves
    max: 1.5, // Bonus for confident moves
  },
  positionWeights: {
    firstPlayer: 0.4,  // Going first is easier
    secondPlayer: 0.6, // Going second is harder
  },
})

// 3. Get environment description for NEAT configuration
console.log(environment.description)
// { inputs: 18, outputs: 9 }
// 18 inputs = 9 squares for player's pieces + 9 for opponent's pieces
// 9 outputs = one for each possible move
```

### Evaluating Individual Genomes (Gauntlet)

```typescript
import type { SyncExecutor } from '@neat-evolution/executor'

import { TicTacToeEnvironment } from '@heygrady/tictactoe-environment'

const environment = new TicTacToeEnvironment({
  // Configure gauntlet opponents
  gauntletOpponents: [
    { opponent: 'minimaxAI', numGames: 5, weight: 0.25 },
    { opponent: 'heuristicAI', numGames: 5, weight: 0.25 },
    { opponent: 'sleeperAI', numGames: 25, weight: 0.25 },
    { opponent: 'randomAI', numGames: 25, weight: 0.25 },
  ],
})

// 1. Evaluate a single genome against all gauntlet opponents
function evaluateGenome(executor: SyncExecutor): number {
  // Returns weighted average score across all opponents
  const fitness = environment.evaluate(executor)
  return fitness
}
```

### Evaluating Head-to-Head Matches

```typescript
import type { SyncExecutor } from '@neat-evolution/executor'

import { TicTacToeEnvironment } from '@heygrady/tictactoe-environment'

const environment = new TicTacToeEnvironment()

// 1. Evaluate a match between two genomes
function evaluateMatch(
  executorA: SyncExecutor,
  executorB: SyncExecutor
): [number, number] {
  // Returns [scoreA, scoreB] from the head-to-head match
  const [scoreA, scoreB] = environment.evaluateBatch([executorA, executorB])
  return [scoreA, scoreB]
}
```

### Using the Factory Function

```typescript
import { createEnvironment } from '@heygrady/tictactoe-environment'

// 1. Use the factory function (useful for worker thread initialization)
const environment = createEnvironment({
  gameOutcomeScores: {
    win: 1.0,
    loss: 0.0,
    draw: 0.5,
  },
})

// 2. Get config for serialization
const config = environment.toFactoryOptions()
// Can be passed to workers for environment recreation
```

### Custom Gauntlet Configuration

```typescript
import {
  TicTacToeEnvironment,
  type OpponentConfig,
} from '@heygrady/tictactoe-environment'

// 1. Define opponent lineup with custom weights
const gauntletOpponents: OpponentConfig[] = [
  // Perfect player - best possible is draw
  { opponent: 'minimaxAI', numGames: 10, weight: 0.4 },
  // Strong player - can sometimes beat
  { opponent: 'heuristicAI', numGames: 10, weight: 0.3 },
  // Weak players - should consistently beat
  { opponent: 'randomAI', numGames: 20, weight: 0.2 },
  { opponent: 'simpleAI', numGames: 10, weight: 0.1 },
]

const environment = new TicTacToeEnvironment({ gauntletOpponents })
```

## Scoring System

### Game Outcome Scores

Base scores awarded for game results:

| Outcome | Default Score | Description |
|---------|---------------|-------------|
| Win | 1.0 | Maximum base score for winning |
| Draw | 0.33 | Partial credit for draw |
| Loss | 0.1 | Small credit to reward playing moves |

### Confidence Multipliers

Scores are adjusted based on the neural network's decisiveness:

- **Low confidence** (uncertain about move): Score × 0.5 (default min)
- **High confidence** (decisive about move): Score × 1.5 (default max)

### Position Weights

Accounts for first-move advantage in Tic-Tac-Toe:

- **First player**: Weight 0.4 (easier position)
- **Second player**: Weight 0.6 (harder position, so scores weighted more)

## License

MIT License - see [LICENSE](../../LICENSE) for details.
