# Memory Map

This file is the routing table, not the database.

## Always start here

1. `../10-current/STATE.md` — what the system is now.
2. `../10-current/ACTIVE_WORK.md` — what is being changed now and its boundaries.
3. `../10-current/ACTIVE_ROADMAP.md` — active roadmap and sub-roadmaps.
4. `../10-current/NEXT.md` — exact next actions and unresolved blockers.

## Route by task

- Architecture/system boundaries → `../20-knowledge/architecture/`
- Existing module/feature → `../20-knowledge/modules/`
- Workflow/data/control flow → `../20-knowledge/flows/`
- Domain/business rules → `../20-knowledge/domain/`
- Roadmaps/spec progression → `../20-knowledge/roadmaps/`
- Diagrams/Excalidraw/system maps → `../20-knowledge/diagrams/INDEX.md`
- Why a durable choice was made → `../30-decisions/`
- Valuable prior state / rollback target → `../40-evolution/checkpoints/`
- How the system evolved → `../40-evolution/TIMELINE.md`
- Failed/reverted approaches → `../40-evolution/failures/`
- Superseded supporting material → `../90-archive/`

## When repository memory is insufficient

Use Git as episodic memory:

1. `git status`
2. `git log --graph --oneline --decorate --all`
3. `git log -- <relevant-path>`
4. `git show <commit>:<path>` / history of deleted files
5. inspect relevant branches and tags

Never recreate a supposedly missing subsystem until this search has been done.

## Retrieval rule

Load the smallest connected subgraph that answers the task. Do not load the whole memory tree into context.

## Write rule

Update current truth first. Then write deeper knowledge only when a stable fact, durable decision, protected checkpoint, meaningful failure, or milestone has actually changed.
