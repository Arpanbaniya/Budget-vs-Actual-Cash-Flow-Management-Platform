# Supabase setup

Phase 2 adds two migrations: the eight user-owned tables with RLS and constraints, then the private `fpna-imports` and `fpna-reports` buckets with per-user object policies. See [database notes](../docs/database.md) for the table map, CSV formats, and exact application commands.

The `stfciijaeixrygvrgdrn` production project already records both migrations as applied. Its dashboard shows all eight public tables. The local Supabase CLI is not authenticated or linked; log in and link it before future migrations. Do not push the Phase 2 migrations again manually.
