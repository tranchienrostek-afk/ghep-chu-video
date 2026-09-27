# Golden Checkpoints

A golden checkpoint is a valuable, difficult-to-recreate, verified state worth explicitly protecting.

Create one before risky transformations or when a major stable capability is achieved.

Recommended record:

```yaml
id: CP-XXX
status: active
commit: <sha>
tag: <optional-golden-tag>
```

Then document:

- why this state matters;
- capabilities present;
- diagrams/roadmap coverage;
- invariants future work must preserve;
- verification/tests;
- restoration procedure.

Do not create golden checkpoints for every trivial commit.
