---
name: monorepo-tips
description: Cross-cutting gotchas and conventions for the hexagonoids monorepo — TypeScript exactOptionalPropertyTypes, prebuild:cjs script defect history, and documentation structure.
tags: [work-session, typescript, monorepo]
---

# Monorepo Tips

## TypeScript: exactOptionalPropertyTypes

`exactOptionalPropertyTypes` is enabled in all package tsconfigs. This has a
non-obvious consequence when constructing objects where optional fields might
be `undefined` at runtime:

```typescript
// WRONG — TS error when value might be undefined at runtime:
interface Foo { bar?: string }
const x: Foo = { bar: maybeUndefined }  // error if maybeUndefined: string | undefined

// CORRECT — declare as T | undefined explicitly:
interface Foo { bar?: string | undefined }
const x: Foo = { bar: maybeUndefined }  // ok
```

This applies to `AgentContext.executor`, simulation config optional fields, and
any interface where the runtime value may literally be `undefined`. Type the
property as `prop?: T | undefined` (not just `prop?: T`) to satisfy exact
optional assignment constraints.

## prebuild:cjs Append Bug (Fixed)

The `prebuild:cjs` script in `template-ts` originally used `>>` (append) instead
of `>` (overwrite). This defect propagated to every package copied from the
template. Running `prebuild:cjs` without a clean step would silently produce
invalid JSON by appending a second object to the file.

**Status**: Fixed in all affected `package.json` files (all 8 template-derived
packages). Future packages from the template should inherit the corrected `>`.

If you add a new package by copying the template, verify the `prebuild:cjs`
script uses `>`, not `>>`.

## Documentation Structure

There is **no `docs/` directory** in this monorepo. Documentation infrastructure
referenced by primers (package charters, ADR index, integration playbooks,
context maps) does not exist. All package-level documentation lives exclusively
in per-package `CLAUDE.md` files.

Do not create stub docs/ directories or placeholder files — update the relevant
`CLAUDE.md` instead.

## TypeScript vs Biome: Bracket Notation Conflict

`Record<string, unknown>` property access creates a conflict between two tools:

- **TypeScript** (`noPropertyAccessFromIndexSignature` or strict index access)
  requires **bracket notation**: `obj['key']`
- **Biome** (`useLiteralKeys` lint rule) flags bracket notation as unnecessary
  when the key is a string literal, requiring **dot notation**: `obj.key`

The two rules are irreconcilable for the same expression. The existing codebase
convention (established in `seekDestroyAgent` and `neatAgent`) is to use bracket
notation to satisfy TypeScript and leave the Biome `info` diagnostics as-is.
Do not attempt to suppress either tool — just leave the bracket notation.

## Documentation Triage Rule

When deciding which packages need doc updates after a session:
- **Skip** packages with only `package.json` changes (e.g., dependency bumps,
  script fixes) or test-only changes.
- **Update** only packages with semantic API changes (exported symbol added,
  renamed, or removed) or behavioral changes visible to consumers.
