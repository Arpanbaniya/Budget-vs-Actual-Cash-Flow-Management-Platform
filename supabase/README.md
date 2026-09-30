# Supabase setup

Phase 2 adds two migrations: the eight user-owned tables with RLS and constraints, then the private `fpna-imports` and `fpna-reports` buckets with per-user object policies. See [database notes](../docs/database.md) for the table map, CSV formats, and exact application commands.

The migrations have not been applied from this workspace because no Supabase project is linked here. They do not affect the deployed foundation until a project is linked, migrations are pushed, and later phases connect the app.
