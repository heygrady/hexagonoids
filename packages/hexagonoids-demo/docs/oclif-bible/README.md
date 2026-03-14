# Hexagonoids Demo Oclif Bible

This folder is the migration dossier for re-imagining `@heygrady/hexagonoids-demo` as an oclif CLI.

Bottom line: this migration is approved in principle, the package is a good fit for it, and the canonical implementation decisions live in [`final-plan.md`](/Users/heygrady/projects/neat-js/.worktrees/hexagonoids-lamarkian/packages/hexagonoids-demo/docs/oclif-bible/final-plan.md).

The strongest signal is the current shape of the codebase:

- feature logic is already split into `src/features/*`
- the real sprawl is in the hand-rolled router and parser layer in [`src/main.ts`](/Users/heygrady/projects/neat-js/.worktrees/hexagonoids-lamarkian/packages/hexagonoids-demo/src/main.ts#L27) and [`src/cli.ts`](/Users/heygrady/projects/neat-js/.worktrees/hexagonoids-lamarkian/packages/hexagonoids-demo/src/cli.ts#L37)
- the package already has distinct operational domains: training, replay, inspection, scenarios, lab, profiles, episodic comparison

That is exactly the kind of CLI that benefits from oclif's command classes, topics, generated help, and shared base commands.

## Recommended stance

Use oclif for command routing, help, parsing, and lifecycle concerns. Keep the domain logic in the existing feature modules. Do not rewrite the ML rig itself.

Final defaults for this package:

- use `topicSeparator: " "` so the UX stays aligned with `inspect inputs`
- use the `pattern` discovery strategy and put compiled commands under `dist/esm/commands`
- keep one package-local CLI; do not split into installable plugins
- introduce a shared `BaseCommand` plus a narrower `TrainLikeCommand` for reused flags and profile loading
- treat `features/*` as application services and `commands/*` as thin adapters
- normalize the CLI surface to standard oclif args and flags; do not preserve quirky positional compatibility
- remove the legacy replay-specific bin from the target design
- reorganize `src` so CLI, browser, node, and domain code have clearer boundaries

## Proposed command topology

Current commands map cleanly to oclif topics:

- `baseline`
- `train`
- `episodic`
- `replay`
- `lab`
- `scenarios`
- `inspect inputs`
- `inspect fitness`

Recommended future file layout:

```text
src/
  browser/
    index.ts
  cli/
    index.ts
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
  command-base/
    base-command.ts
    train-like-command.ts
    flags.ts
    ux.ts
  features/
    training/
    runtime/
    persistence/
    registries/
    profiles/
    inspect/
    lab/
    scenarios/
    episodic/
  hooks/
    init/
      load-runtime.ts
  node/
    index.ts
  index.ts
```

## Read this in order

- [`glossary.md`](/Users/heygrady/projects/neat-js/.worktrees/hexagonoids-lamarkian/packages/hexagonoids-demo/docs/oclif-bible/glossary.md)
- [`feasibility-study.md`](/Users/heygrady/projects/neat-js/.worktrees/hexagonoids-lamarkian/packages/hexagonoids-demo/docs/oclif-bible/feasibility-study.md)
- [`target-topology.md`](/Users/heygrady/projects/neat-js/.worktrees/hexagonoids-lamarkian/packages/hexagonoids-demo/docs/oclif-bible/target-topology.md)
- [`migration-plan.md`](/Users/heygrady/projects/neat-js/.worktrees/hexagonoids-lamarkian/packages/hexagonoids-demo/docs/oclif-bible/migration-plan.md)
- [`final-plan.md`](/Users/heygrady/projects/neat-js/.worktrees/hexagonoids-lamarkian/packages/hexagonoids-demo/docs/oclif-bible/final-plan.md)

## Key external references

- oclif introduction: <https://oclif.io/docs/introduction/>
- commands: <https://oclif.io/docs/commands/>
- flags: <https://oclif.io/docs/flags/>
- args: <https://oclif.io/docs/args/>
- config: <https://oclif.io/docs/config/>
- command discovery: <https://oclif.io/docs/command_discovery_strategies/>
- topics: <https://oclif.io/docs/topics/>
- topic separator: <https://oclif.io/docs/topic_separator/>
- hooks: <https://oclif.io/docs/hooks/>
- plugins: <https://oclif.io/docs/plugins/>
- help classes: <https://oclif.io/docs/help_classes/>
- performance: <https://oclif.io/docs/performance/>
- `@oclif/core` repository, including Node 18+ requirement: <https://github.com/oclif/core>
