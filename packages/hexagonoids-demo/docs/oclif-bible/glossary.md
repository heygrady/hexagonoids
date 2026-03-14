# Glossary

This glossary maps the package's organic language to oclif's language so future design discussions stay precise.

| Our term | Oclif term | How oclif describes it | How we should use it here |
| --- | --- | --- | --- |
| CLI rigging | CLI config + bin scripts + command discovery | oclif handles entrypoints, command loading, help, hooks, and runtime config through `package.json` and bin scripts | move routing concerns out of `src/main.ts` and into oclif config and `bin/run.js` |
| feature | command or topic | commands are executable units; topics are command groups created by directories | `train`, `replay`, `lab`, `scenarios` are commands; `inspect` is a topic |
| sub-feature | subcommand | nested commands under a topic | `inspect inputs` and `inspect fitness` become subcommands under `inspect/` |
| router | command discovery + parser + dispatcher | oclif finds command classes, parses args and flags, then runs the selected command | replace the manual `if` chain in [`src/main.ts`](/Users/heygrady/projects/neat-js/.worktrees/hexagonoids-lamarkian/packages/hexagonoids-demo/src/main.ts#L727) |
| command handler | command class | a class extending `Command` with `static flags`, `static args`, help metadata, and `run()` | each current top-level mode gets its own class |
| shared options | shared flags | flags can be shared via base classes or shared builders | centralize train-like flags instead of re-parsing them in multiple loops |
| profile loading | base command concern | oclif recommends shared command logic through a base class | `TrainCommand` and `LabCommand` should inherit profile resolution helpers |
| usage text | help output | oclif generates help from command metadata; can be customized with a help class | stop hand-maintaining a giant `usage()` string |
| diagnostics hook-up | hooks | lifecycle hooks like `init` and `command_not_found` can run before or around commands | use sparingly for runtime setup, telemetry, or env validation |
| plugin in the ML sense | not the same as oclif plugin | in oclif, plugins are distributable CLI extensions with their own commands/hooks | keep RL algorithm plugins separate from oclif plugin terminology |
| package extension | oclif plugin | a plugin can add commands or hooks to a CLI | maybe useful later for optional experiment packs, but not needed for the first cut |
| taxonomy | topics + topic separator | oclif organizes commands by directories and can use spaces or colons | use spaces so `inspect inputs` remains natural |
| domain service | non-command module | oclif does not care how you structure business logic behind commands | keep `src/features/*`, `train.ts`, and persistence modules mostly intact |
| command alias | alias | command metadata can expose alternate names | use for compatibility if old names need to survive temporarily |
| replay binary | legacy bin concern, not a design target | npm can expose multiple bin scripts, but that does not make them good architecture | drop the old replay-specific bin and make replay a normal command |
| custom formatting | help class or shared UX helpers | help can be customized via `helpClass`; normal output should use command methods | use shared formatters for result tables and summaries, not for core parsing |
| browser API | browser entry point | package exports can expose a browser-friendly module graph | use `/browser` as the explicit browser API home |
| node API | node entry point | package exports can expose node-specific modules that rely on `node:*` imports | use `/node` for node-only helpers and integrations |
| cli API | CLI entry point | package exports can expose programmatic CLI helpers separately from the app API | use `/cli` for CLI programmatic entrypoints and shared rigging |

## Terminology decisions

Use these terms in planning and implementation:

- say `command` instead of generic `feature` when it is directly executable
- say `topic` for a command namespace like `inspect`
- say `base command` for shared parsing or setup behavior
- say `application service` for the underlying feature module that does the real work
- reserve `plugin` for oclif-distributed CLI extensions, not RL or NEAT plugins
- say `normalized CLI surface` when we mean standard flags and args with no custom compatibility shims

## Translation examples

- "add a new feature for evaluating weird genomes" becomes "add a new command under `src/commands/inspect/` or `src/commands/analysis/`"
- "the CLI rigging is messy" becomes "routing, flag parsing, help generation, and dispatch are over-centralized"
- "this tool should be independent" becomes "this command should own only its flags/help and delegate execution to a service module"
