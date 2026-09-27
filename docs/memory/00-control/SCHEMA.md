# Memory Schema

Use lightweight metadata when it improves provenance.

Recommended fields:

```yaml
id: <stable-id>
status: active | proposed | superseded | archived
last_verified_commit: <sha-or-null>
related:
  - <path-or-id>
evidence:
  - <commit/test/file/diagram>
superseded_by: <id-or-null>
```

Rules:

- stable IDs do not change when filenames move;
- do not claim verification without evidence;
- unresolved claims remain in current work/next actions;
- current summaries stay bounded; details move into linked leaf files;
- supersede instead of deleting decisions/history.
