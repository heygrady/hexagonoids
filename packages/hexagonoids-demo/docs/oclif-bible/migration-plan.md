# Migration Plan

This plan assumes a single cutover, not a long hybrid period.

Status: superseded by [`final-plan.md`](/Users/heygrady/projects/neat-js/.worktrees/hexagonoids-lamarkian/packages/hexagonoids-demo/docs/oclif-bible/final-plan.md) for implementation decisions.

## Goal

Replace the manual CLI surface with oclif while preserving existing domain behavior and command names.

## Phase 0: lock decisions

Make these decisions before touching code:

1. Raise package support to Node 18+ unless there is a hard monorepo constraint.
2. Keep space-separated commands via `topicSeparator: " "`.
3. Use `pattern` command discovery.
4. Keep one CLI package for phase 1.
5. Preserve current user-facing commands and flag names unless there is a strong reason not to.
6. Do not preserve quirky positional compatibility unless it maps cleanly to standard oclif args.

## Phase 1: add oclif runtime

Update [`package.json`](/Users/heygrady/projects/neat-js/.worktrees/hexagonoids-lamarkian/packages/hexagonoids-demo/package.json):

- add `@oclif/core`
- add an `oclif` section
- update `bin` wiring to point to oclif bin scripts
- update `files` so packaged output includes new bin scripts and compiled command files
- update `engines.node` if adopting current oclif

Recommended `oclif` config shape:

```json
{
  "oclif": {
    "bin": "hexagonoids-demo",
    "dirname": "hexagonoids-demo",
    "topicSeparator": " ",
    "commands": {
      "strategy": "pattern",
      "target": "./dist/esm/commands"
    }
  }
}
```

Add bin scripts:

- `bin/run.js`
- `bin/dev.js`

## Phase 2: create the command base layer

Create:

- `src/command-base/base-command.ts`
- `src/command-base/train-like-command.ts`
- `src/command-base/shared-flags.ts`
- `src/command-base/profile-resolution.ts`
- `src/command-base/output.ts`

Responsibilities:

- define reusable flag groups
- centralize profile merge order
- centralize validation and coercion where custom parsing is still needed
- centralize result formatting helpers

This phase replaces the implicit reuse currently living in [`src/main.ts`](/Users/heygrady/projects/neat-js/.worktrees/hexagonoids-lamarkian/packages/hexagonoids-demo/src/main.ts#L161).

## Phase 3: move commands over one-for-one

Create these command files:

- `src/commands/baseline.ts`
- `src/commands/train.ts`
- `src/commands/episodic.ts`
- `src/commands/replay.ts`
- `src/commands/lab.ts`
- `src/commands/scenarios.ts`
- `src/commands/inspect/inputs.ts`
- `src/commands/inspect/fitness.ts`

Migration rule:

- copy business behavior, not parser structure
- map positional arguments to `Args.*`
- map options to `Flags.*`
- move per-command help into static metadata
- keep `run()` methods thin

Expected delegation map:

- `baseline` -> `train()` with `baselineOnly: true`
- `train` -> `train()`
- `episodic` -> `runEpisodic()`
- `replay` -> `replayGenome()`
- `lab` -> `runLab()`
- `scenarios` -> `runGenerateScenariosCommand()` or a refactored service function beneath it
- `inspect inputs` -> `runInspectInputs()`
- `inspect fitness` -> `runInspectFitness()`

## Phase 4: retire the old router

After parity is reached:

- delete or deprecate `src/main.ts`
- delete or deprecate `src/cli.ts`
- replace `bin/index.js` with an oclif bin, or remove it if superseded

Do not keep the old top-level parser alive after the cutover. That only preserves the source of the maintenance problem.

## Phase 5: test the CLI at the command boundary

Replace parser-centric tests with command-centric tests.

Test at least:

1. `--help` for each command
2. success path for each command
3. invalid flag values for train-like commands
4. replay positional and flag compatibility, if both are supported
5. nested topic resolution for `inspect inputs` and `inspect fitness`

If you adopt oclif test helpers later, good. It is not required for the first migration.

## Phase 6: optional polish

Only after parity:

- add `@oclif/plugin-help` if you want an explicit `help` command in addition to `--help`
- add a custom help class if default help proves insufficient
- add lifecycle hooks for startup diagnostics or telemetry
- add performance instrumentation through oclif settings if startup profiling matters
- consider plugin boundaries for optional command packs

## Compatibility notes

### Replay and lab normalization

Do not preserve the current replay and lab quirks just because they exist today.

Recommendation:

- `replay` should use a standard required path arg plus normal flags
- `lab` should use normal flags, not a magical positional method shorthand
- if a surface cannot be expressed naturally with standard `Args` and `Flags`, simplify the surface instead of adding custom parsing

### Output formatting

Current commands write ad hoc `console.log()` output.

Recommendation:

- use `this.log()` inside commands
- keep human-readable text output by default
- only opt commands into `--json` if a stable machine-readable schema is worth maintaining

## Expected implementation order

1. package metadata and bin scripts
2. base command layer
3. `replay` command, because it is the smallest isolated migration
4. `inspect` subcommands, because they validate topics and nested help
5. `baseline` and `train`, because they validate shared flags and profile handling
6. `lab`, `scenarios`, and `episodic`
7. remove old router
8. update README usage examples

## Definition of done

The migration is done when:

- every current command runs through oclif
- help is generated by command metadata rather than a manual `usage()` block
- no new command requires editing a global parser or dispatcher
- shared flags live in reusable command abstractions
- the old router is removed
