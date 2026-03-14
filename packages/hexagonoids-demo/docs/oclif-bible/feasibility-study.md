# Feasibility Study

## Verdict

This is a strong candidate for an oclif migration.

The migration is mostly a CLI-surface refactor, not a domain rewrite.

## Why it fits

The current package has a clean separation between command-worthy domains and the work they perform:

- command-worthy domains already exist in `train`, `replay`, `lab`, `scenarios`, `episodic`, and `inspect`
- nested command structure already exists conceptually in `inspect inputs` and `inspect fitness`
- feature code is already grouped under [`src/features`](/Users/heygrady/projects/neat-js/.worktrees/hexagonoids-lamarkian/packages/hexagonoids-demo/src/features)

The main scaling problem is that CLI concerns are centralized:

- one large `usage()` block in [`src/main.ts`](/Users/heygrady/projects/neat-js/.worktrees/hexagonoids-lamarkian/packages/hexagonoids-demo/src/main.ts#L27)
- one large shared-option parser in [`src/main.ts`](/Users/heygrady/projects/neat-js/.worktrees/hexagonoids-lamarkian/packages/hexagonoids-demo/src/main.ts#L161)
- command dispatch as a top-level `if` ladder in [`src/main.ts`](/Users/heygrady/projects/neat-js/.worktrees/hexagonoids-lamarkian/packages/hexagonoids-demo/src/main.ts#L727)
- replay maintaining a second hand-rolled parser in [`src/cli.ts`](/Users/heygrady/projects/neat-js/.worktrees/hexagonoids-lamarkian/packages/hexagonoids-demo/src/cli.ts#L52)

That is exactly the category of complexity oclif is built to absorb.

## What can stay

These parts should survive mostly unchanged:

- `train.ts`
- `EvolutionManager.ts`
- persistence modules
- `src/features/lab/*`
- `src/features/scenarios/*`
- `src/features/inspect/*`
- `src/features/profiles/*`
- `src/features/episodic/index.ts`

In the target design, those become application services called by command classes.

## What should change

These parts should change substantially:

- `bin/index.js`
- `src/main.ts`
- `src/cli.ts`
- CLI-focused tests that currently target manual parsers
- `package.json` CLI metadata and bin wiring

## Oclif decisions that fit this repo

### 1. Use an existing-project migration, not a greenfield rewrite

The official docs explicitly support initializing oclif in an existing project, adding bin scripts, config, and dependencies rather than requiring a new repository.

This package already has a working build pipeline and should preserve that.

### 2. Use command classes plus a base command

oclif commands are classes with metadata and a `run()` method. The docs also point to base-command usage for shared behavior.

This maps well to your current reuse needs:

- shared train-like flags
- profile resolution
- consistent numeric validation
- shared result formatting

### 3. Use topics with a space separator

oclif supports nesting commands by directory and supports either `:` or a space as the topic separator.

Because the current UX already speaks in space-separated terms like `inspect inputs`, the best fit is:

```json
{
  "oclif": {
    "topicSeparator": " "
  }
}
```

That preserves the current mental model while still using standard oclif command files.

### 4. Use `pattern` discovery first

oclif supports `pattern`, `explicit`, and `single` command discovery.

For this repo, `pattern` is the right default:

- commands can live conventionally under `src/commands`
- the build already emits `dist/esm`
- there is no current bundling requirement
- command independence improves when file discovery matches directory structure

Use `explicit` only if you later bundle the CLI or want dynamic command registration.

### 5. Keep plugins as a phase-2 capability

oclif plugins are useful for modular extension, but introducing them immediately would increase migration surface area.

The right first move is one package-local CLI with strong internal modularity.

Only split to plugins later if one of these becomes true:

- you want installable optional command packs
- other CLIs should reuse the same commands
- you want experimental domains to ship independently

## Main benefits

### Scalable command ownership

Each command gets its own file, metadata, flags, examples, and tests. Adding a new tool no longer means touching a global parser.

### Generated help instead of hand-maintained help

Your current help text is already large and drift-prone. oclif generates help from command metadata and can be customized later with a help class.

### Cleaner reuse boundaries

Today, shared options are reused procedurally through `parseSharedOption()`. In oclif, they become declarative shared flags and helper methods on base classes.

### Better independence without sacrificing encapsulation

The current package already encapsulates behavior fairly well. oclif mainly fixes the orchestration layer.

## Real risks

### Node version mismatch

`@oclif/core` currently supports Node 18+, and the package metadata should match that floor.

That means the package should align on Node 18+ for the CLI migration rather than carrying stale Node 16 metadata.

### Flag compatibility drift

Some current commands accept mixed positional and flag styles, especially replay and lab. If not handled deliberately, migration could introduce small UX regressions.

Mitigation:

- define compatibility expectations up front
- use args only where the positional form is clearly valuable
- add aliases and deprecation notes where needed

### Overusing hooks or plugins

oclif provides hooks and plugins, but they are not a substitute for normal command design. If used too early, they can recreate hidden routing complexity.

Mitigation:

- prefer commands and base classes first
- reserve hooks for lifecycle setup
- reserve plugins for cross-package extension

## Recommendation

Proceed with an all-at-once CLI-surface migration.

Do not do a long-lived hybrid where both the manual parser and oclif own routing. That would double the complexity in exactly the area that already hurts.

The single-cutover version is realistic because the domain execution code is already separate from routing.
