# @heygrady/tictactoe-demo

## 0.2.0

### Minor Changes

- 1312d28: Adjust training configuration: increase minimax opponent weight to 0.6, decrease sleeper weight to 0.4, and increase seed tournaments to 25

### Patch Changes

- 1312d28: Remove unused @neat-evolution dependencies identified by depcheck
- Updated dependencies [1312d28]
- Updated dependencies [1312d28]
- Updated dependencies [1312d28]
  - @heygrady/tictactoe-environment@0.1.1
  - @heygrady/tictactoe-game@0.1.1
  - @heygrady/tournament-strategy@0.1.1

## 0.1.0

### Minor Changes

- 6bb78fc: Add tic-tac-toe game packages with NEAT AI training support
  - tictactoe-game: Pure game logic with multiple AI player types (minimax, heuristic, random, NEAT)
  - tictactoe-environment: NEAT environment adapter for evolving neural network players
  - tictactoe-demo: CLI training pipeline with evolution manager
  - tournament-strategy: Glicko-2 rating system and Swiss tournament pairing strategies

### Patch Changes

- Updated dependencies [6bb78fc]
  - @heygrady/tictactoe-game@0.1.0
  - @heygrady/tictactoe-environment@0.1.0
  - @heygrady/tournament-strategy@0.1.0
