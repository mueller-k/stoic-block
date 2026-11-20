# Domain docs

## Layout

This repository uses a single-context layout:

- `CONTEXT.md` at the repository root: domain terminology.
- `docs/adr/`: architecture decision records.

## Before exploring

Read `CONTEXT.md` and ADRs relevant to the area being explored.

If they do not exist, proceed silently. Domain modeling creates
them lazily when terminology or decisions are resolved.

## Vocabulary

Use terms defined in `CONTEXT.md` in issues, proposals, hypotheses,
and tests. Reconsider unfamiliar synonyms; note real vocabulary
gaps for domain modeling.

## ADR conflicts

Explicitly identify any proposal that contradicts an existing ADR,
and explain why the decision should be reconsidered.
