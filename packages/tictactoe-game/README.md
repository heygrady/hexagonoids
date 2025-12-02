# @heygrady/tictactoe-game

A pure TypeScript implementation of Tic-Tac-Toe game logic with multiple AI
player types. This package provides the core game mechanics, board
representation, and a variety of AI opponents ranging from random play to
optimal minimax strategy, including support for neural network-based players.

## Purpose

- **Game Logic**: Provide board representation, move validation, and win/draw
  detection
- **AI Players**: Offer multiple AI implementations with varying skill levels
  for training and evaluation
- **Neural Network Support**: Enable NEAT-based agents to play via the `neatAI`
  player
- **Board Transformations**: Normalize board orientations for consistent neural
  network inputs

## How it Fits into the Ecosystem

- **@heygrady/tictactoe-environment**: Uses this package's game logic and AI
  players to evaluate NEAT genomes
- **@heygrady/tictactoe-demo**: Imports AI players for training opponents and
  interactive play
- **@heygrady/hexagonoids-app**: Displays game state and allows users to play
  against AI opponents

## Installation

This package is hosted on [GitHub Packages](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-npm-registry). You'll need to configure your package manager to use the GitHub Packages registry for the `@heygrady` scope.

### Yarn (v2+)

Add to your `.yarnrc.yml`:

```yaml
npmScopes:
  heygrady:
    npmAlwaysAuth: true
    npmRegistryServer: "https://npm.pkg.github.com"
```

Then install:

```bash
yarn add @heygrady/tictactoe-game
```

### npm

Create a `.npmrc` file in your project root:

```
@heygrady:registry=https://npm.pkg.github.com
```

Then install:

```bash
npm install @heygrady/tictactoe-game
```

## Key Components

### Types

- **`Board`**: A 9-element tuple representing the game board (0 = empty, 1 = X,
  -1 = O)
- **`Player`**: The current player (1 for X, -1 for O)
- **`GameState`**: Tuple of `[isWin, isDraw, winner]` for checking game
  completion
- **`PlayerFn`**: Function signature for AI players:
  `(board, player, options?) => PlayerMove`
- **`PlayerMove`**: Tuple of `[newBoard, moveIndex, fitness]` returned by all
  players

### Game Functions

- **`getInitialBoard()`**: Returns a fresh empty board
- **`checkState(board)`**: Returns the current game state (win/draw/ongoing)
- **`getValidMoves(board)`**: Returns array of valid move indices (0-8)
- **`getCandidateMoves(board, player)`**: Returns categorized move candidates
  (winning, blocking, developing, open)
- **`getForkingCandidateMoves(board, player)`**: Extended analysis including
  fork detection

### AI Players

| Player        | Strategy                                                    | Skill Level |
| ------------- | ----------------------------------------------------------- | ----------- |
| `randomAI`    | Picks winning/blocking moves when obvious, otherwise random | Low         |
| `simpleAI`    | Uses basic heuristics (center, corners, edges)              | Low-Medium  |
| `heuristicAI` | Evaluates positions using strategic priorities              | Medium      |
| `minimaxAI`   | Optimal play using minimax with alpha-beta pruning          | Perfect     |
| `neatAI`      | Neural network-based decision making                        | Variable    |
| `sleeperAI`   | Intentionally delays winning for training purposes          | Special     |

### Board Utilities

- **`boardToInput(board, player)`**: Converts board to neural network input
  format with orientation normalization
- **`reorientBoard(board)`**: Transforms board to canonical orientation for
  consistent NN inputs

## Usage

### Basic Game Loop

```typescript
import {
  type Board,
  checkState,
  getInitialBoard,
  getValidMoves,
  type Player,
} from "@heygrady/tictactoe-game";

// 1. Initialize the game
let board = getInitialBoard();
let currentPlayer: Player = 1; // X goes first

// 2. Game loop
while (true) {
  const [isWin, isDraw, winner] = checkState(board);

  if (isWin) {
    console.log(`Player ${winner === 1 ? "X" : "O"} wins!`);
    break;
  }
  if (isDraw) {
    console.log("It's a draw!");
    break;
  }

  // 3. Get valid moves and make a move
  const validMoves = getValidMoves(board);
  const move = validMoves[0]; // Simple: pick first valid move

  // 4. Apply the move
  board = [...board] as Board;
  board[move] = currentPlayer;

  // 5. Switch players
  currentPlayer = currentPlayer === 1 ? -1 : 1;
}
```

### Using AI Players

```typescript
import {
  type Board,
  checkState,
  getInitialBoard,
  minimaxAI,
  type Player,
  randomAI,
} from "@heygrady/tictactoe-game";

// 1. Set up players
const players = {
  1: randomAI, // X uses random AI
  [-1]: minimaxAI, // O uses perfect play
};

// 2. Play a game
let board = getInitialBoard();
let currentPlayer: Player = 1;

while (true) {
  const [isWin, isDraw] = checkState(board);
  if (isWin || isDraw) break;

  // 3. Get the AI's move
  const playerFn = players[currentPlayer];
  const [newBoard, move, fitness] = playerFn(board, currentPlayer);

  console.log(
    `Player ${currentPlayer === 1 ? "X" : "O"} plays position ${move}`,
  );
  board = newBoard;
  currentPlayer = currentPlayer === 1 ? -1 : 1;
}
```

### Using NEAT AI with an Executor

```typescript
import type { SyncExecutor } from "@neat-evolution/executor";

import {
  type Board,
  checkState,
  getInitialBoard,
  neatAI,
  type Player,
} from "@heygrady/tictactoe-game";

// 1. Assume you have a trained neural network executor
const executor: SyncExecutor = foo; /* your trained network */

// 2. Play using the NEAT AI
let board = getInitialBoard();
const player: Player = 1;

const [newBoard, move, fitness] = neatAI(board, player, {
  executor,
  verbose: true, // Log decision details
});

console.log(`NEAT chose position ${move} with fitness ${fitness.toFixed(3)}`);
```

### Converting Board to Neural Network Input

```typescript
import {
  type Board,
  boardToInput,
  getInitialBoard,
  type Player,
} from "@heygrady/tictactoe-game";

// 1. Create a board state
const board: Board = [
  1,
  0,
  -1,
  0,
  1,
  0,
  0,
  0,
  -1,
];
const player: Player = 1;

// 2. Convert to neural network input
// Returns 18 values: 9 for player's pieces + 9 for opponent's pieces
const [input, inverseTransform] = boardToInput(board, player);

console.log("NN Input:", input);
// Output is normalized so the board appears in a canonical orientation

// 3. After getting NN output, use inverseTransform to map back to original orientation
const nnOutput = [0.1, 0.8, 0.1, 0.2, 0.1, 0.3, 0.4, 0.2, 0.1]; // example
const originalOutput = inverseTransform(nnOutput as Board);
```

## License

MIT License - see [LICENSE](../../LICENSE) for details.
