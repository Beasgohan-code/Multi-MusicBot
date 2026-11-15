# Master product roadmap

Status: Phase 0 implementation in progress; live feasibility gates remain unverified. Captures the visible user blueprint received 2026-11-15; that message ends mid-sentence at “Expired temporary permissio”. Missing requirements are not inferred. A–Q is 17 systems, not 16.

## Direction and authority

A multi-user Telegram bot-hosting platform with group management, music, and an eventual web/Mini App control surface. Reference projects inform behavior; they do not establish working integrations. Playeon's separate lounge implementation has not been identified/inspected; lounge ideas below are product requirements, not verified upstream capabilities.

This document governs scope/release ordering; ARCHITECTURE.md governs runtime boundaries; PHASE_0_ACCEPTANCE.md governs initial validation. SOURCE_COMPARISON.md and VIDEL0_RECONCILIATION.md record research, not deployment evidence. Earlier Node-first voice preferences are superseded by the latest Python-first blueprint.

Target: TypeScript/Telegraf control plane + Python/PyTgCalls voice service. Evaluate Wzgram in isolation for MTProto compatibility, with Kurigram as a baseline/alternative. Select one client per assistant environment, not both Pyrogram namespace providers together. No package/version is accepted merely because a README calls it compatible.

## Detailed feature logic

[PRODUCT_LOGIC.md](PRODUCT_LOGIC.md) extends this roadmap with setup diagnostics, capability-aware controls, fair requests, maintenance modes, moderation preview/cases, config diffs, privacy controls, incident bundles and scheduled sessions. It specifies request admission, acknowledgement/deduplication, lease fencing, queue fairness, sanction expiry, deletion, quota settlement, degradation and acceptance scenarios. New features retain their stated gates; no implementation is implied.

## Release gates

- **G0 Feasibility:** permitted local-file voice playback, IPC correlation, assistant lease, process cleanup, secret redaction and actual Render test. All live gates remain unrun.
- **G1 Private alpha:** controller, secure bot registration, explicit lifecycle, tenant repositories, encrypted secrets, quotas, moderation basics, core audio/queues/cards, safe upcoming-track recovery. Shared main/worker modules; one bot/owner and one active call initially.
- **G2 Music beta:** search/provider adapters, personal/group playlists, DJ requests/votes, seek/quality/effects, localization, aggregates and operational recovery.
- **G3 Web platform:** authenticated Next.js dashboard/Mini App, team roles, browser library synchronization, optional 2D lounge. Separate API/auth/realtime acceptance gates.
- **G4 Expansion:** subscriptions, migrations/transfers, advanced plugin lifecycle, channel/video, advanced audio, optional 3D lounge and integrations. Individual features can be rejected after feasibility review.

These are dependency gates, not calendar/price promises. Security, useful diagnostics, unit tests, permission checks and relevant integration tests ship with every feature, not at the last gate.

## Catalogue coverage

| System | G1/G2 commitment | Later scope and critical boundaries |
|---|---|---|
| A Accounts | Telegram identity from actual updates, allowlist, profile basics, onboarding and audit | G3 verified web/Mini App login, sessions/revocation, teams; G4 support/appeals. Never trust browser-submitted Telegram IDs |
| B Bot hosting | Connect existing BotFather bot; getMe validation, desired/observed lifecycle, branding/settings, failures and rotation | G3 config history/export; G4 worker migration, backup/restore and confirmed transfer. Duplicate config is not duplicate Telegram identity; username changes remain BotFather-controlled |
| C Discovery | G2 query/URL search, pagination, metadata, explicit source, adapter priority, bounded cache/cooldowns and provider errors | TypeTube optional, disabled until terms/trust/egress tests; no promise of complete album/artist catalogues or unrestricted media |
| D Voice playback | G1 play/pause/resume/skip/stop/end/leave, next track, bounded queue, current status; G2 seek/replay/jump/shuffle/loop, preparation, quality and bounded reconnect | G4 video/channel and permitted call creation; validate target authority and actual engine support |
| E Audio | G2 volume, safe default restore, validated bass/speed/EQ presets | G4 normalization, fades, stereo/mono, per-track overrides, crossfade/noise reduction only after pipeline/CPU proof. Report rejected settings; never silently claim requested effect was applied |
| F Queue/DJ | G1 serialized tenant queues and snapshots; G2 temporary DJs, request/approval/cooldown/cancel, duplicate controls, vote skip and export | Explicit priority policy; no unbounded starvation. Recovery never silently replays interrupted current; restore upcoming metadata with authorization |
| G Playlists | G2 create/rename/delete/add/remove/reorder, bounded import/export, favorites/history, personal/group permissions | G3 sharing links/cloud sync; G4 collaboration, covers and conflict handling. Sharing does not grant moderation or DJ authority |
| H Rich Telegram UI | G1 normal text/HTML cards, inline buttons, pagination, safe escaping, authorized/expired callbacks and edit throttling | G2 emoji registry with glyph fallback; advanced rich tables/details/colored buttons/widgets only after real API/client capability tests. Python nextgram is not a Telegraf module |
| I Lounge | Not needed for Telegram playback | G3 optional 2D room, authorized realtime controls/presence/lyrics/chat/invites; G4 3D, reactions, leaderboard. Browser audio clock and Telegram voice timeline are distinct; no guaranteed end-to-end sample sync |
| J Analytics | G1 health/failures; G2 confirmed plays, provider latency, prep time, aggregate trends and scoped export | Browser presence ≠ audible listening; Telegram voice attendance ≠ verified listeners. Personal history private by default; listening duration metrics require disclosed measurement and confidence limits |
| K Plugins | First-party feature modules with schemas, permissions, enable/disable tests and cleanup | G4 versioned catalogue/compatibility/migration/rollback. No arbitrary tenant-uploaded executable code. Lyrics/radio/downloader/video/lounge/EQ/scheduler/languages/AI each need separate acceptance; AI cannot bypass auth or execute raw commands |
| L Security | Tenant policies, secret encryption/redaction, rate limits, input validation, scoped audit and encrypted backup design | Web auth, CSRF/origin, session revocation and webhook verification added before respective surfaces. Hidden buttons are not authorization |
| M Subscriptions | Central entitlement/quota interface with manual plans; enforce atomic reservations | G4 paid plans, supported Stars/provider integration, signed verified events, idempotency/refund reconciliation, grace/downgrade behavior. Confirm current platform rules first |
| N Owner console | Controller-only masked status, worker/assistant health, suspension, versions, drain and job diagnostics | G3 web operator view; G4 provider/plugin/billing management. No raw-token dumps, public metrics or unfiltered startup logs |
| O Reliability | Readiness/liveness state, watchdog, bounded retry, durable jobs, dedup, queue recovery, lease reconciliation and shutdown | Later distributed coordination and service splitting only when measured. Background-worker health does not require public HTTP; no free-tier keepalive tricks |
| P Localization | G2 English/Hindi/Malayalam catalogues and fallback, group/user language precedence, readable output | G3 keyboard/mobile accessibility; G4 timezone-aware scheduling with explicit DST policy. Translations need review; no decorative language switch |
| Q Developer tools | Internal protocol versioning, trace IDs, redacted structured logs, CI fixtures and simulated events | G3 API docs; G4 API keys/scoped webhooks, SDK and plugin sandbox. Realtime/API endpoints require auth, replay handling and backpressure |

Group management remains required despite its smaller representation in the supplied catalogue: welcome/goodbye, rules/notes, warnings, mute/ban/kick, rights diagnostics, durable sanction expiry; anti-flood/link opt-in after tests. Federation and complex raid automation are not launch commitments.

## Web and authentication gate

Next.js is a future client, not a second queue authority. Validate Telegram Mini App initData signatures server-side with the correct bot context, short age policy and replay/session controls; never trust initDataUnsafe. Telegram Login is a distinct validation flow. Authenticate once, issue revocable server-side sessions, and recheck tenant/object permissions on every API and WebSocket action. Bind expected audience/tenant and reject tokens minted for other bots. Cookie sessions need appropriate Secure/HttpOnly/SameSite settings and CSRF/origin checks.

Realtime events include tenant scope, sequence/revision, request correlation and reconnect snapshots. Rate-limit room joins/reactions, authorize server-side, cap history, and moderate room chat. Media access/redistribution and browser autoplay restrictions must be considered separately from voice playback permission. No direct browser access to bot/assistant/provider secrets.

## Data integrity and collection policy

The long collection catalogue is a domain inventory, not an instruction to create 35 empty collections. Create validated collections and indexes with their feature migrations. Initial canonical naming stays in ARCHITECTURE.md (e.g. music_queues vs proposed queues, assistants/call_leases vs assistant_accounts/assistant_leases, plays vs play_history, audit_events vs audit_logs). Keep one canonical repository per domain, not parallel stores under both names. Split groups/settings or playlist metadata/items only when bounded-document/query needs justify it.

- botId is mandatory on bot-owned records; ownerId supplements it, never replaces tenant scope. Derive identity from authenticated context.
- Enforce unique bot identity. Token fingerprints, if retained, use a secret-keyed digest and support rotation; ciphertext comparison is not uniqueness.
- Unique botId+chatId settings; separate unique active music binding for a group. Assistant slot unique under the initial one-call model, with fenced generations.
- Queue mutations use revisions and atomic admission; avoid transactions spanning external Telegram/media effects.
- Duplicate requests use atomic active-state constraints when enabled, not permanent group+track uniqueness preventing future plays.
- Playlist reorder must handle temporary position collisions atomically; choose bounded arrays/revision or transactional reorder before index design.
- Temporary permission/lease validity is checked on every action. TTL deletion is eventual and cannot enforce authorization expiry or timely unmute.
- Ownership transfer requires both parties, version checks, revoking stale team sessions, confirmed resource/entitlement changes, and a compatible transactional database deployment.
- Persist stable media metadata, not cookies, expiring signed URLs or temporary local paths in recovery snapshots.
- Audit retention, personal history opt-in, deletion/export and backup restoration require explicit policy/tests. Logs are bounded/redacted and not raw payload archives.

## Resource and infrastructure constraints

Initially one paid Render worker/container runs Node plus the supervised Python voice child; MongoDB Atlas is external. Temporary audio uses capped ephemeral storage. No Redis/object storage/dashboard is required to prove the first call. Redis can later provide cache/pubsub/coordination, but MongoDB remains durable source of truth; define loss/rebuild semantics before adding it. Object storage needs scoped signed access, expiry and retention when exports/covers/backups require it.

Logical bots sharing a Node process do not have accurate isolated per-bot OS CPU/RAM measurements. Report host/process measurements separately from attributed request/download/stream usage estimates. Hard resource isolation needs actual process/container boundaries. Per-bot environment settings are schema-validated application configuration, not arbitrary process environment, executable flags or filesystem access.

Assistant sessions are operator-provisioned locally. One library owns each session, one tested slot initially. Expired DB leases alone do not stop a live native stream; adapter fencing and reconciliation are mandatory. Voice crash must not take down group moderation. No claims about free hosting, unlimited calls or listener counts based solely on references.

## Definition of done for any feature

A release item needs purpose, real handler/API, validated config/data schema, scope/permission matrix, lifecycle transitions, error/retry behavior, resource limits, redacted audit/metrics, unit tests, relevant integration tests, user docs, and recorded acceptance evidence. Plugin-off means no handlers/jobs consuming resources. A disabled capability shows a truthful unavailable state, not a working-looking button.

## Remaining decisions and input

The latest blueprint selects Python-first; this roadmap adopts that planning direction without installing anything. Exact Wzgram/PyTgCalls pins and Render compatibility await G0. Initial access/quota defaults remain proposed. A separate Playeon lounge URL is needed before source comparison; no extra source is assumed. Please provide the remainder of the truncated integrity section if it contains additional requirements. Implementation starts with G0, not the entire catalogue.

## Implementation checklist — actual progress (2026-11-15)

Initial repository audit found README + seven planning documents, no application code, dependency manifests or test suite. No existing working runtime was replaced. The following checklist is implementation status, not a replacement roadmap.

- [x] Buildable strict TypeScript ESM project, npm lockfile and offline Node/Python test commands. Validated here on Node 22.22.3 / Python 3.11.2; Node 24 remains the deployment target, not tested here.
- [x] Validated platform config and bounded initial queue/call limits; error messages exclude submitted config values.
- [x] AES-256-GCM vault: fresh nonce, versioned keys, authenticated bot/purpose context, tamper rejection and rotation compatibility (unit-tested).
- [x] MongoDB-driver credential repository: encrypted create/read/rotate/delete, authenticated-owner scope parameters and explicit unique/lookup index initialization (unit contract tests). Runtime caller authorization is not implemented by this repository alone.
- [x] TypeScript/Python bounded framing + strict request schema; actual cross-process protocol roundtrip tested. No simulated playback success.
- [x] Local session-output helper: exclusive create, 0600 permissions, injection rejection; tested. Interactive Kurigram provisioning script implemented, but real login untested.
- [x] Isolated voice dependency constructor checks: Wzgram 3.1.7 + PyTgCalls 2.3.3 + ntgcalls 2.2.5 FAILS (missing GroupcallForbidden import); Kurigram 2.2.26 baseline constructs successfully. Baseline transitive versions recorded in requirements-kurigram.lock.txt. Neither result proves live playback.
- [ ] Execute real MongoDB integration test with TEST_MONGODB_URI (currently skipped; no database service configured).
- [ ] Complete voice adapter operations/events, IPC timeouts/backpressure, native media handles, fencing, process supervision and actual assistant login/calls.
- [ ] Validate FFmpeg installation, image build and real Render network/audio behavior (FFmpeg absent in current sandbox).
- [ ] Implement operator-scoped controller, authenticated worker registration and actual Telegraf runtime.
- [ ] Implement durable worker lifecycle/reconciliation, group permissions and tenant isolation beyond credential repository contracts.
- [ ] Implement atomic assistant allocation, authoritative durable queues, deduplication and crash recovery.
- [ ] Implement moderation, expanded music, frontend and later roadmap gates only after their dependencies.

Verification: npm run check passes 10 Node tests + 5 Python tests and TypeScript build. npm run test:integration reports 1 skipped test, not a passing database integration. npm audit --omit=dev reports zero known advisories at this run; not a security audit. No live-feature completion is claimed. TODO.md does not exist.

### Voice execution increment (2026-11-15)

- [x] `apps/voice-engine/runtime.py`: serialized fixed-slot request execution, bot/chat/session/generation binding, revision checks, bounded request-result deduplication, local-media allowlist and safe failure state. Unit-tested with explicitly test-only engine doubles.
- [x] `apps/voice-engine/native_adapter.py`: actual Kurigram/PyTgCalls start/play/pause/resume/leave calls, disabled automatic call creation/video, noninteractive authorization guard. Adapter call contracts tested; factory constructed with installed native libraries offline. A failing native-constructor regression test exposed and fixed PyTgCalls rejecting a Client subclass by module identity.
- [x] `apps/voice-engine/server.py`: executable private framed-stdin child with validated startup settings, FFmpeg requirement, serialized output, signal/finally cleanup and bounded session lifetime. Framing/config tests pass; authenticated startup is not live-tested.
- [x] `apps/bot-runtime/voice-process.ts`: bounded single-flight child IPC, response/session/revision correlation, operation-specific terminal-event checks, timeout/crash rejection and process-group shutdown. Subprocess transport harness tests pass; harness is not a production voice substitute.
- [ ] Native stream-end/disconnection callbacks and async event deduplication; current child exposes command results only, so automatic queue advance is not implemented.
- [ ] Durable assistant broker/lease renewal/reassignment. Current child is explicitly provisioned to one immutable binding and maximum lifetime (default 120 seconds, at most 3600); generation comparison alone is not a distributed fencing service.
- [ ] Real-media audibility, native cleanup under actual calls, reconnect recovery, Docker/Render soak and multi-bot lifecycle acceptance remain unverified.

Latest verification: `npm run check`: build + 14 Node tests pass, 16 Python tests pass with 1 installed-library test skipped under system Python. `.venv-kurigram/bin/python -m unittest discover -s tests/voice -v`: all 17 Python tests pass, including actual installed-library construction (no Telegram network). Mongo integration still skips without TEST_MONGODB_URI. No controller, moderation, queue, frontend or production assistant-pool completion is claimed. TODO.md remains absent.

### Phase 0 native events, queue state and durable-lease increment (2026-11-15)

- [x] PyTgCalls `add_handler` subscription with real `StreamEnded` AUDIO/MICROPHONE and `ChatUpdate.Status.LEFT_CALL` types; public `await engine.calls` snapshot monitoring covers missing native calls. Runtime deduplicates terminal events and distinguishes disconnect from normal completion. Real installed-library objects/call snapshots tested offline, not Telegram network.
- [x] Python child serializes command/native outputs through a bounded queue and aborts on failed writer/monitor; TypeScript delivers validated native events independently of pending commands, with session/generation/source checks and terminal deduplication.
- [x] Authoritative queue transition module and MongoDB CAS repository implemented: revisions, bounded local-media metadata, confirmed source matching, one-step completion/skip, desired vs acknowledged pause/resume, interrupted state, safe upcoming snapshots/manual restore. Event-to-queue function handles concurrent revision races without consuming two tracks.
- [x] MongoDB assistant repository implemented with unique assistant/active-group indexes, atomic acquire, server-time renewal/expiry validation, holder+generation release after cleanup, and monotonic generation increment. Expired slots remain unavailable until trusted cleanup; no unsafe automatic expiry-based seizure.
- [ ] Production integration of these modules into a lease-renewing/reaping queue runner; automatic execution of persisted start/stop intents is not implemented yet. Queue state transitions passing tests is not a demonstrated audible next-track transition.
- [ ] Authenticated controller worker registration/lifecycle remains pending. Repositories are internal runtime APIs, not external authorization endpoints.
- [ ] Database integration, real audio/Telegram playback, worker death during a real call, reconnect/native process cleanup and controlled Render resource measurement remain unverified. Phase 0 exit criteria NOT MET; do not move to Phase 1.

Important conservative constraint: PyTgCalls 2.3.3 native stream-end carries no application track ID. A Python child now permits only one media track, so delayed callbacks cannot be relabeled as another track. The eventual runner must close/reap the old child before starting a new child for the next track. Seamless same-child source switching is intentionally not claimed.

Evidence: `npm run check` passes build and 23 Node tests; system Python passes 18 tests with 3 native-environment tests skipped. Isolated Kurigram environment passes all 21 Python tests. `npm run test:integration` has 3 explicit skips without TEST_MONGODB_URI (credential, queue, assistant tests). Unit collection doubles only verify contracts/CAS behavior; they do not establish MongoDB server correctness. TODO.md remains absent.

### Phase 0 runner evidence update — 2026-11-15

The operator-only playback entrypoint now wires Mongo queue/leases/audit to one-track Python children, polls persisted controls and renews a conservative child deadline after guarded DB renewal. Latest local check: build + 40 Node tests pass; regular Python 21 pass/3 native skips, isolated Kurigram 24 pass. Real Mongo integration remains 3 skips. Queue recovery cannot clear uncertain-cleanup quarantine. See PHASE_0_ACCEPTANCE.md for execution limits. Abandoned-lease reconciliation, transactional transition audit, authenticated controller/supervisor wiring, full failure matrix and Telegram/Render tests remain incomplete; no Phase 1 advancement.

### Expanded clone-platform audit and worker-auth increment — 2026-11-15

The latest architecture target makes the bot factory, multi-bot owner quotas, clone manager, versioned per-clone settings/customization, assistant assignments, plugin isolation and separate platform/clone workspaces mandatory. `ARCHITECTURE.md` sections 10–15 map real files, settings application boundaries, model/index gaps and delivery gates. Earlier one-bot-per-owner direction is superseded as a product constraint; rollout capacity may still be restricted by safety measurements.

- [x] Audit existing implementation into target boundaries without moving or rewriting the voice path.
- [x] Harden internal worker registration: original-grant authentication for heartbeat, pre-renewal suspension/revocation checks, explicit binding validation and token/holder/generation-fenced cleanup reports. Unit tests demonstrate failure before renewal on revoked/suspended/DB-error paths.
- [x] Add opt-in real Mongo worker race/revocation/quarantine test; **not executed successfully** without a configured Mongo target.
- [ ] Complete Phase 0 late-settlement handling, abandoned native-holder reconciliation and durable transition auditing before fleet activation.
- [ ] Wire authenticated controller/supervisor with bounded heartbeat loss and trusted cleanup evidence; no arbitrary client `clean` flag.
- [ ] Implement transactional factory registration with getMe verification, multi-bot plan reservation, template configuration/history and encrypted credentials.
- [ ] Implement one versioned settings save → worker apply → correlated acknowledgement vertical slice, then expand required settings domains.
- [ ] Implement permission-scoped plugins/jobs, assistant management and platform/clone workspaces after their execution/auth dependencies.

Evidence: `npm run check` passes build + **50 Node tests**; regular Python **21 pass / 3 native skips**; isolated Kurigram **24 pass**. `npm run test:integration` reports **4 skips**, not verified Mongo behavior. No Telegram/Render verification or Phase 1 advancement. No empty modules or frontend mockups added; TODO.md absent.

### Safety-first continuation: quarantine reconciliation and supervisor — 2026-11-15

- [x] Implement exact-holder/generation/server-expiry quarantine reconciliation methods for workers and assistants, preserving assistant active-chat ownership. Atomically persist abandonment events in a bounded embedded outbox.
- [x] Wire authenticated registry claim and bounded heartbeats into the operator playback entrypoint; require WORKER_GRANT and check expected bot before playback.
- [x] Abort/drain on ownership loss, quarantine uncertain cleanup and reject persistence failures without fake success. Latch runner stop before acquisition to close a startup cancellation gap.
- [x] Add unit tests for late heartbeat, renewal DB outage, cleanup-persistence outage, wrong tenant, runtime error, graceful drain and reconciliation CAS/error contracts.
- [ ] Complete abandoned ownership cleanup proof/release, operator reconciliation workflow and safe host-crash recovery. Quarantine is not release.
- [ ] Durable audit for **all** worker/assistant transitions, outbox relay/archival, late DB/queue settlement and supervisor drain limits remain incomplete.
- [ ] Real Mongo and Telegram process-crash/outage acceptance; full readiness and controller integration; clone onboarding remain gated.

Evidence: build + **63 Node tests pass**; regular Python **21 pass / 3 skip**. Real Mongo suite **5 skips** (including new abandonment quarantine test) because no target is configured. Unit failure scenarios are doubles, not end-to-end crash acceptance. No Bot Factory, per-clone settings or frontend started; no Phase 0 completion claim.

### Ownership audit/outbox and maintenance continuation — 2026-11-15

- [x] Add atomic bounded ownership events to implemented worker claim/heartbeat/finish and assistant acquire/renew/release updates; retain tenant scope in events after live fields are cleared.
- [x] Add replay-safe archive-before-ack relay with unique event index, strict field/type policy and no ack on archive failure. Integrate relay into operator supervisor heartbeat/finish.
- [x] Add bounded bot-scoped expired-holder scan and `npm run phase0:maintain` trusted-operator batch; quarantine only, never release or restart.
- [x] Test archive/ack outage and replay contracts, cross-tenant/malformed rejection, atomic update shapes and bounded scan behavior. Add opt-in real Mongo release/outbox/replay test.
- [ ] Verify these aggregation/outbox paths on real Mongo. No configured test service: all six integration cases skip.
- [ ] Finish native cleanup evidence and safe unquarantine, supervisor drain/late-operation hardening, queue terminal journal and real process-crash recovery before factory onboarding.

Verification: `npm run check` passes build + **70 Node tests**, Python **21 pass / 3 skips**; isolated Kurigram **24 pass**. Outbox/reconciliation unit doubles do not prove real Mongo behavior. No Python playback rewrite, new dashboard or clone onboarding. TODO.md absent.


### NEXT delivery cycle and late-cleanup settlement — 2026-11-15

For each NEXT: inspect branch/status/history and repository/docs, compare code to plans, choose one dependency-safe increment, demonstrate failing tests, implement and run relevant checks, reconcile existing documentation, review the full patch for secrets/generated files, commit and push only the active branch, then report exact evidence and the next task. Do not enable onboarding before live Phase 0 acceptance; missing credentials/services are explicit blockers, not test passes.

- [x] Reproduce and fix runner settling before delayed native shutdown: hold run busy until shutdown settles; retain assistant and blocked state after timeout, including late clean/rejected results.
- [x] Offline regression suite: build + 72 Node PASS; Python 21 PASS / 3 SKIP; installed-Kurigram 24 PASS. Six Mongo integration SKIP; lint not configured. Production dependency audit: zero known advisories.
- [ ] Next: fence and settle late assistant acquire/renew and queue mutations, then harden process-group/drain escalation and verified host cleanup/release. Existing shutdown timeout is not a cancellation primitive.

This delivery also checkpoints the previously uncommitted Phase 0 implementation from earlier accepted increments; those foundations are not new work from this single regression fix. Final commit/push identifiers are reported in the engineering response rather than predicted here.

### NEXT: late assistant acquisition settlement — 2026-11-15

- [x] Reproduce acquisition timeout letting `runOne` finish before the underlying acquire resolves; fix by observing that same promise to settlement without retry or native start.
- [x] Compensate only a known returned late generation with exact holder/generation release and no constructed child. Observe late rejection; retain ownership/blocking on failed compensation.
- [x] Three deferred-operation regressions pass; no Python/native behavior changed. Final build + 75 Node PASS; regular Python 21 PASS / 3 SKIP, isolated Kurigram 24 PASS, real Mongo 6 SKIP. No lint configuration exists.
- [ ] Next increment: late renewal settlement with prompt native teardown, followed by late queue/release mutations. Trusted host cleanup, bounded escalation and live Phase 0 gates still block onboarding.
