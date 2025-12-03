# @heygrady/hexagonoids-app

## 0.3.4

### Patch Changes

- 475dadb: Fix population switching race condition that caused wrong algorithm data to be saved to IndexedDB
- 6defccb: Upgrade all @neat-evolution packages to latest versions (0.3.5 core, 0.6.2
  algorithms, 0.5.2+ environment/evaluator)
- Updated dependencies [6defccb]
  - @heygrady/tictactoe-demo@0.2.1
  - @heygrady/tictactoe-environment@0.1.2

## 0.3.3

### Patch Changes

- 79d2ac7: Restore extractModulePath function for proper production builds - the previous refactor broke module loading in production by removing the code that extracts bundled filenames from Vite's glob imports

## 0.3.2

### Patch Changes

- 87709c2: Improve tic-tac-toe experiment page with comprehensive technical details about NEAT training, Swiss tournaments, Glicko-2 ratings, board canonicalization, and links to blog post and repository

## 0.3.1

### Patch Changes

- 1312d28: Remove unused dependencies (tictactoe-game, @neat-evolution/evolution)
- 1312d28: Improve reset button styling and generations slider UX in SettingsPanel
- 1312d28: Simplify vite glob import using ?url query parameter
- Updated dependencies [1312d28]
- Updated dependencies [1312d28]
- Updated dependencies [1312d28]
  - @heygrady/tictactoe-demo@0.2.0
  - @heygrady/tictactoe-environment@0.1.1

## 0.3.0

### Minor Changes

- 6bb78fc: Add tic-tac-toe experiment with NEAT AI training UI
  - Implement interactive tic-tac-toe board with multiple AI opponents
  - Add training visualization with live statistics
  - Configure Vite for @neat-evolution worker module compatibility
  - Improve game engine pool system and shared infrastructure

### Patch Changes

- Updated dependencies [6bb78fc]
- Updated dependencies [6bb78fc]
  - @heygrady/h3-babylon@0.1.1
  - @heygrady/tictactoe-game@0.1.0
  - @heygrady/tictactoe-environment@0.1.0
  - @heygrady/tictactoe-demo@0.1.0

## 0.2.0

### Minor Changes

- 09dbb71: Refactor the h3-babylon functions to a new package

### Patch Changes

- Updated dependencies [09dbb71]
  - @heygrady/h3-babylon@0.1.0

## 0.1.0

### Minor Changes

- f545835: Configuring changesets and vercel

### Patch Changes

- c94b409: update title
- 059d5ea: enable astro vercel
