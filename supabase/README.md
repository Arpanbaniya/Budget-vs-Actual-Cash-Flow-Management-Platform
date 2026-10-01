# Supabase setup

Three migrations define eight owned tables, RLS/private Storage, and transactional
import processing. Apply them in timestamp order to a new project. The connected
production project has the schema, private buckets, and Phase 6 RPCs applied.

The two Phase 2 migrations were recorded in migration history. Phase 6 was applied
through the SQL editor with user approval. Inspect/reconcile CLI migration history
before using `db push` on this existing project. The local CLI is not authenticated
or linked; do not blindly replay migrations against production.

See [database notes](../docs/database.md), [security](../SECURITY.md), and
[authentication](../docs/auth.md). Application operations use the publishable key
and caller JWT; service-role keys are not required.
