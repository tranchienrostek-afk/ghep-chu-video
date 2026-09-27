# Memory Flow Protocol

## Session start / resume

1. Read the memory map and current files.
2. Identify the affected subsystem.
3. Follow only relevant memory links.
4. Inspect recent/relevant Git history.
5. Reconstruct missing context before making substantial changes.

## Before modifying an existing subsystem

SEARCH BEFORE BUILD:

- current implementation;
- related module/flow/architecture memory;
- decisions;
- protected checkpoints;
- relevant Git history, branches, tags, and deleted paths.

Preserve existing capabilities unless removal is explicit.

## During work

Keep `ACTIVE_WORK.md` accurate for long/risky work. Record unresolved hypotheses as unresolved; do not promote them into durable truth.

## Before commit

- verify new behavior;
- regression-check protected old behavior;
- rewrite `STATE.md` to current truth;
- rewrite `NEXT.md` to exact continuation state;
- update roadmap/workstream status if changed;
- add ADR/checkpoint/timeline/failure record only when semantically warranted;
- run relevant tests and memory doctor.

## Before compact / stop

The next fresh agent must be able to continue without the conversation. Persist the exact current state, next action, blockers, and verification status.

## Recovery

If memory and code disagree, do not guess. Use code/tests for observed behavior, ADR/spec for intended design, Git for historical truth, and explicitly record unresolved conflicts.
