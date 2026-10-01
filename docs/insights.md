# Management insights

`POST /api/v1/companies/{id}/insights` accepts `from`, `to`, `cash_start_date`,
and optional `scenario_id`. It reuses the dashboard services to build a compact
fact pack containing summaries, top unfavorable groups, and cash-risk facts.
Raw files and source transactions are never sent to Groq.

SHA-256 hashes canonical facts, parameters, provider mode, model, and prompt
version. Owned analysis records cache unchanged requests. Changing finance data
or parameters invalidates the cache. Transient provider fallback is cached until
facts/configuration change; a temporarily unavailable cache does not block output.

Defaults: `AI_PROVIDER=none`, `GROQ_MODEL=llama-3.3-70b-versatile`,
`AI_TIMEOUT_SECONDS=20` (1–60). To enable Groq, set `AI_PROVIDER=groq` and a
server-only `GROQ_API_KEY`. No key is required for deterministic commentary.

Groq prioritizes existing fact IDs and chooses from authored review actions using
JSON output. The backend validates that selection and renders every figure from
its own facts. Free-form model prose is deliberately excluded: the provider
cannot add numbers, claim causes, or supply investment advice. All facts remain
visible even if the provider selects only a subset. Invalid, oversized, rate-limited,
or timed-out responses fall back. Output labels identify Groq AI, deterministic
fallback, and cache reuse. This is management commentary, not causal analysis.

Provider API references: [Groq chat](https://console.groq.com/docs/text-chat) and
[JSON output](https://console.groq.com/docs/structured-outputs). CI uses mocks only.
