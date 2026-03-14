# Final Plan

This document is the authoritative implementation plan.

It replaces speculative compatibility questions with concrete decisions.

## Decisions

### 1. Oclif is the CLI framework

`@heygrady/hexagonoids-demo` will migrate to oclif for:

- command discovery
- arg and flag parsing
- help generation
- command dispatch
- CLI lifecycle wiring

The current manual router and parser layer will be removed after cutover.

### 2. The CLI surface will be normalized

The current CLI contains a few quirky affordances, especially around `replay` and `lab`.

We will not preserve quirks just because they exist.

The rule is:

- if a command shape maps naturally to standard oclif `Args` and `Flags`, use that shape
- if a current shape is awkward, custom, or redundant, simplify it
- do not add compatibility-only parsing logic

Internal tool status makes this the correct tradeoff.

### 3. One primary CLI bin only

The package target is:

- `hexagonoids-demo -> bin/run.js`

There is no separate replay bin in the new design.

`replay` becomes a normal command. The old replay script can disappear or fail during migration so long as the package builds until the cutover is complete.

### 4. Source layout will be clarified

The top-level `src` layout is currently too flat for the actual complexity of the package.

The new shape is:

```text
src/
  browser/
    index.ts
  cli/
    index.ts
  command-base/
    base-command.ts
    train-like-command.ts
    shared-flags.ts
    output.ts
  commands/
    baseline.ts
    train.ts
    episodic.ts
    replay.ts
    lab.ts
    scenarios.ts
    inspect/
      inputs.ts
      fitness.ts
  features/
    episodic/
    inspect/
    lab/
    persistence/
    profiles/
    registries/
    runtime/
    scenarios/
    training/
  hooks/
    init/
      runtime.ts
  node/
    index.ts
  index.ts
```

### 5. Package entry points will be explicit

The package API will expose:

- `@heygrady/hexagonoids-demo`
- `@heygrady/hexagonoids-demo/browser`
- `@heygrady/hexagonoids-demo/node`
- `@heygrady/hexagonoids-demo/cli`

Meaning:

- default export target: browser-friendly API
- `/browser`: explicit browser-friendly API
- `/node`: node-specific API
- `/cli`: programmatic CLI entrypoints and CLI-oriented helpers

If the runtime/environment supports conditional exports cleanly, the default entry can resolve appropriately. But the source organization and explicit subpath exports are the main design requirement.

### 6. Node support metadata should be updated

The repo is effectively on modern Node already.

This package should declare Node 18+ support during the migration and align its `engines.node` floor with the chosen oclif version.

## Normalized command surface

These are the target command shapes.

### `baseline`

Standard flag-only command:

```bash
hexagonoids-demo baseline --method NEAT --baseSeed seed-1
```

### `train`

Standard flag-only command:

```bash
hexagonoids-demo train --method NEAT --profile default
```

### `episodic`

Standard flag-only command:

```bash
hexagonoids-demo episodic --iterations 20 --populationSize 64
```

### `replay`

Required path arg, standard flags:

```bash
hexagonoids-demo replay ./path/to/genome.json --method NEAT --seed replay-1
```

No `--path` flag. No alternate positional form. No custom compatibility parsing.

### `lab`

Standard flags only:

```bash
hexagonoids-demo lab --method NEAT --name smoke-test --profile default
```

No positional algorithm shorthand.

### `scenarios`

Standard flags only:

```bash
hexagonoids-demo scenarios --output ./scenario-bank.json --seed scenario-refresh-1
```

### `inspect inputs`

Standard flags only:

```bash
hexagonoids-demo inspect inputs --seed debug-1 --agent random
```

### `inspect fitness`

Standard flags only:

```bash
hexagonoids-demo inspect fitness --genome ./genome.json --seed debug-1
```

## Source moves

These moves are part of the plan, not optional cleanup.

### Move domain primitives under `features`

Current top-level modules should be reorganized:

- `train.ts` -> `src/features/training/train.ts`
- `EvolutionManager.ts` -> `src/features/training/EvolutionManager.ts`
- `GenerationSeededStrategy.ts` -> `src/features/training/GenerationSeededStrategy.ts`
- `algorithmRegistry.ts` -> `src/features/registries/algorithmRegistry.ts`
- `persistence/*` -> `src/features/persistence/*`

Likely homes for the rest:

- `buildEnvironmentOptions.ts` -> `src/features/runtime/buildEnvironmentOptions.ts`
- `configDefaults.ts` -> `src/features/runtime/configDefaults.ts`
- `evaluation/*` -> `src/features/training/evaluation/*`
- `serialization/*` -> `src/features/training/serialization/*`

### Replace `main.ts` and `cli.ts`

Current files:

- [`src/main.ts`](/Users/heygrady/projects/neat-js/.worktrees/hexagonoids-lamarkian/packages/hexagonoids-demo/src/main.ts)
- [`src/cli.ts`](/Users/heygrady/projects/neat-js/.worktrees/hexagonoids-lamarkian/packages/hexagonoids-demo/src/cli.ts)

Target:

- `src/cli/index.ts` for programmatic CLI access
- `src/commands/*` for actual command implementations
- `bin/run.js` and `bin/dev.js` for oclif bootstrapping

`src/main.ts` and `src/cli.ts` will be deleted after cutover.

## Entry point design

### `src/browser/index.ts`

Browser-friendly surface.

This is the explicit home for the web-app-facing demo API.

### `src/index.ts`

Default package surface.

This should stay browser-friendly and re-export from `src/browser/index.ts` unless there is a strong reason not to.

### `src/node/index.ts`

Node-only helpers and APIs that depend on `node:*` imports.

This should be close in spirit to the browser entry, but allowed to expose node-specific helpers such as filesystem-backed loading or CLI-adjacent utilities.

### `src/cli/index.ts`

Programmatic CLI surface.

This should expose:

- the oclif entry wiring needed for tests or programmatic invocation
- shared CLI-facing helpers if any are worth exporting

It should not become another manual router.

## Package.json decisions

The package will gain:

- `oclif` configuration
- `./browser` export
- `./node` export
- `./cli` export
- updated `bin` mapping for the oclif runtime
- updated `engines.node`

Conceptual export shape:

```json
{
  "exports": {
    ".": {
      "types": "./dist/types/browser/index.d.ts",
      "import": "./dist/esm/browser/index.js",
      "require": "./dist/cjs/browser/index.js"
    },
    "./browser": {
      "types": "./dist/types/browser/index.d.ts",
      "import": "./dist/esm/browser/index.js",
      "require": "./dist/cjs/browser/index.js"
    },
    "./node": {
      "types": "./dist/types/node/index.d.ts",
      "import": "./dist/esm/node/index.js",
      "require": "./dist/cjs/node/index.js"
    },
    "./cli": {
      "types": "./dist/types/cli/index.d.ts",
      "import": "./dist/esm/cli/index.js",
      "require": "./dist/cjs/cli/index.js"
    }
  }
}
```

Exact conditional export details can be finalized during implementation, but this is the intended public shape.

## Oclif configuration decisions

Use:

- `topicSeparator: " "`
- command discovery strategy: `pattern`
- commands target: `./dist/esm/commands`

No plugin split in phase 1.

No custom help class in phase 1.

Hooks are allowed only for real startup/setup needs, not for command routing tricks.

## Command base design

### `BaseCommand`

Owns:

- shared output helpers
- shared error handling patterns
- shared access to package/runtime config

### `TrainLikeCommand`

Owns:

- common training and baseline flags
- scenario flags
- fitness flags
- gate flags
- RL flags
- profile loading and merge behavior

`baseline`, `train`, and likely `lab` should build on this.

## Execution order

Implement in this order:

1. Update docs and lock the plan.
2. Update `package.json` metadata, exports, bins, and engine floor.
3. Create `src/browser/index.ts`, `src/cli/index.ts`, and the new `src/features/*` homes.
4. Move domain modules into `features` and update internal imports.
5. Add oclif runtime and command discovery config.
6. Create `command-base` abstractions.
7. Implement `replay` with the normalized arg-plus-flags shape.
8. Implement `inspect` subcommands.
9. Implement `baseline` and `train`.
10. Implement `lab`, `scenarios`, and `episodic`.
11. Remove `src/main.ts`, `src/cli.ts`, and the old bin wiring.
12. Rewrite CLI tests around oclif commands.
13. Update package README examples and any internal docs that mention the old surface.

## Definition of done

The migration is complete when:

- the package builds with the new folder layout
- `hexagonoids-demo` runs through oclif
- every current tool exists as a normal oclif command
- no command depends on custom compatibility parsing
- the default package entry is browser-friendly
- `/browser`, `/node`, and `/cli` exports exist
- the old manual CLI router is gone
- docs reflect the normalized command surface
