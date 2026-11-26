# Master product roadmap

Status: Phase 0 implementation in progress; live feasibility gates remain unverified. Captures the visible user blueprint received 2026-11-15; that message ends mid-sentence at “Expired temporary permissio”. Missing requirements are not inferred. A–Q is 17 systems, not 16.

## Direction and authority

A multi-user Telegram bot-hosting platform with group management, music, and an eventual web/Mini App control surface. Reference projects inform behavior; they do not establish working integrations. Playeon's lounge was inspected at the pinned revision in SOURCE_COMPARISON.md; its restrictive license forbids an assumed commercial code port. Generic independently implemented ideas remain gated, and upstream performance claims are unverified.

This document governs scope/release ordering; ARCHITECTURE.md governs runtime boundaries; PHASE_0_ACCEPTANCE.md governs initial validation. SOURCE_COMPARISON.md and VIDEL0_RECONCILIATION.md record research, not deployment evidence. Earlier Node-first voice preferences are superseded by the latest Python-first blueprint.

Target: TypeScript/Telegraf control plane + Python/PyTgCalls voice service. Isolated testing selected Kurigram 2.2.26 / PyTgCalls 2.3.3 / ntgcalls 2.2.5; Wzgram 3.1.7 failed compatibility. Select one client per assistant environment, not both Pyrogram namespace providers together. No package/version is accepted merely because a README calls it compatible.

## Current continuation contract and priority

Each NEXT audits **all eight repository Markdown files** (README, PLAN and docs), Git and actual source/tests; demonstrates RED before behavior changes; implements one bounded dependency-safe increment; runs targeted/wider checks; reviews secrets, tenancy and races; updates existing docs; commits/pushes only the active branch and reports exact evidence/skips. Do not create repetitive audit documents or TODO placeholders. Missing services are blockers, never passes.

Current foundation: authenticated operator supervisor, exact-holder/generation lease guards, quarantine, atomic ownership outbox/relay, late acquire/renew/queue/release/shutdown settlement, truthful terminal acknowledgements, atomic terminal receipts and trusted operator archive-before-ack relay. None proves audible playback or safe host-crash takeover.

Next safety priority: terminal relay acceptance on real Mongo, process-group escalation/host cleanup and conservative crash reconciliation, then real Phase 0 Telegram/FFmpeg/Render acceptance. Supervisor heartbeat settlement is implemented in the latest checkpoint below. No factory onboarding or attractive frontend before those gates. Afterward: authenticated multi-bot factory/quotas → clone lifecycle → one desired/applied settings roundtrip → shared group/music modules → plugins/web/Mini App/lounge/billing at their gates. All A–Q scope and independent clone workspaces remain required, not silently dropped.

## Detailed feature logic

[PRODUCT_LOGIC.md](PRODUCT_LOGIC.md) extends this roadmap with setup diagnostics, capability-aware controls, fair requests, maintenance modes, moderation preview/cases, config diffs, privacy controls, incident bundles and scheduled sessions. It specifies request admission, acknowledgement/deduplication, lease fencing, queue fairness, sanction expiry, deletion, quota settlement, degradation and acceptance scenarios. New features retain their stated gates; no implementation is implied.

## Release gates

- **G0 Feasibility:** permitted local-file voice playback, IPC correlation, assistant lease, process cleanup, secret redaction and actual Render test. All live gates remain unrun.
- **G1 Private alpha:** controller, secure bot registration, explicit lifecycle, tenant repositories, encrypted secrets, quotas, moderation basics, core audio/queues/cards, safe upcoming-track recovery. Shared main/worker modules; multiple bots/owner within persisted plan limits, measured rollout cap and one active call initially.
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

Python-first is implemented offline with the pinned Kurigram stack; actual Render compatibility awaits G0. Initial capacity must be measured. Playeon research is recorded in SOURCE_COMPARISON.md; no additional URL or stack approval is needed. Please provide the remainder of the truncated integrity section if it contains additional requirements. Implementation continues within G0, not the entire catalogue.

## Historical implementation checkpoints (2026-11-15)

The checkpoints below retain evidence from successive increments; old test counts and then-pending work are historical, not the current task list. The current priority/status is at the top of this document and in the final checkpoint.

Initial repository audit found README + seven planning documents, no application code, dependency manifests or test suite. No existing working runtime was replaced. The following entries record status at each historical checkpoint, not a replacement roadmap.

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

### NEXT: late renewal settlement — 2026-11-15

- [x] Reproduce and fix early release while DB renewal remains pending; native teardown precedes interruption persistence, while release/holder finish await exact renewal settlement.
- [x] Share one shutdown attempt across main/error/finally paths. Block replay and child renewal after DB renewal loss; uncertain cleanup retains ownership.
- [x] Preserve upcoming metadata when completion races failed renewal; retain exactly-once completion for timely valid renewal. Six new deferred-operation cases pass.
- [x] Build + 81 Node PASS; runner suite 22 PASS; regular Python 21 PASS / 3 SKIP; isolated Kurigram 24 PASS. Real Mongo 6 SKIP, lint not configured. No live safety gate is satisfied by doubles.
- [x] Late queue/release mutation settlement (see increment below).
- [ ] Next: durable terminal persistence. Unresolved promises, host-native cleanup/release proof, supervisor escalation and live Phase 0 acceptance remain safety blockers.

### Late queue/release settlement increment

Runner retains exact outstanding queue mutations and cleanup release promises beyond their deadlines. Native teardown precedes draining late queue writes; guarded lease release and holder completion wait for settlement, without retries or late success audit. Recovery excludes concurrent run/recovery. Timeout blocks this runner; a late begin/completion may still persist and requires explicit recovery, not replay. Never-settling operations deliberately retain the holder. Durable terminal journaling, host-crash cleanup and real Telegram/Mongo/Render acceptance remain separate gates. Playeon lounge ideas and restrictive licensing are recorded in SOURCE_COMPARISON.md; onboarding and lounge implementation remain gated.

### Terminal acknowledgement truthfulness

A correlated native terminal event alone no longer authorizes a successful runner result or completion/advancement audits. The source-bound queue CAS must report that it applied. If skip, stop, recovery or interruption supersedes the source before persistence, the runner fails closed with `TERMINAL_NOT_APPLIED`, reaps the child, performs exact guarded release only after cleanup, and remains blocked. This is conservative rejection, not reconciliation or a durable terminal journal. Normal successful CAS retries remain bounded and duplicate events do not advance twice. Durable receipt/outbox journaling and real process-crash acceptance remain unfinished; onboarding stays disabled.

### Atomic terminal receipt checkpoint

- [x] Accepted end/disconnect now appends a minimal source-bound receipt atomically with the queue transition; recovery/stop preserve evidence. Legacy queues initialize on first new receipt only.
- [x] Capacity 100 fails closed without eviction; a full journal prevents binding new playback. Duplicate interruption cannot create another receipt.
- [x] Five initial regressions observed RED, then eight new unit tests total including simulated committed-write/lost-ack recovery and scoped CAS assertions. New real Mongo concurrent duplicate/reconstruction coverage is present but skipped without configuration.
- [x] Tenant-scoped archive-before-ack relay with revision fencing and idempotent identities, now exposed only through trusted bounded operator maintenance. Pending capacity remains 100 until acknowledged; no automated scheduler is deployed.
- [ ] Pre-persistence native-event crash loss, durable runner audits, host cleanup, real Mongo/Telegram/Render acceptance and onboarding remain blocked. Terminal receipts are not cleanup evidence.


### Documentation reconciliation and terminal relay checkpoint

Reviewed all eight repository Markdown files against current source/tests, not only the roadmap tail. Removed stale approval/no-code/Node-native defaults, permanent one-bot-per-owner assumptions and requests for an already-inspected Playeon URL. Updated worker/supervisor/audit implementation maps and marked old evidence checkpoints historical. Product scope A–Q, shared main/worker moderation, multiple-bot quotas, independent clone workspaces/settings desired/applied revisions, disabled-plugin execution checks, Videl0 catalogue fallbacks and later web/lounge/billing gates are retained. No new audit document or empty module tree was created.

Implemented and wired `TerminalOutbox` into trusted `phase0:maintain`: tenant-scoped immutable archive identity, majority-acknowledged archive before revision-fenced removal, strict payload validation, bounded batches and replay without playback. A concurrent queue change rejects; prefer drained maintenance. This is not a native cleanup/release or public endpoint. Missing module RED was observed before implementation; two further unacknowledged-write regressions were observed RED before hardening. Twelve relay tests now pass.

Verification: `npm run check` build/typecheck + **112 Node PASS**, regular Python **21 PASS / 3 optional-native SKIP**; isolated locked Kurigram **24 PASS**; real Mongo **8 SKIP**, including new tenant-scoped relay/revision integration case. Production dependency audit reports 0 known vulnerabilities; lint script absent. No live Telegram/Render evidence or Phase 1 advancement.

Subsequent supervisor settlement work is recorded below. Process-group cleanup/escalation and unknown native-holder quarantine remain required. Run terminal relay/CAS tests on a real configured Mongo before claiming persistence acceptance. Serialized runtime relay scheduling, complete runner audit delivery, pre-persistence event loss, host-crash cleanup and actual Phase 0 acceptance remain open. No factory onboarding before these gates.


### Supervisor late heartbeat settlement checkpoint

- [x] Re-read all eight repository Markdown files, inspect clean active-branch status/history before edits, and review supervisor/transport source. Preserve full multi-bot/clone/settings/group/plugin/web scope and live acceptance gates.
- [x] Five observed RED regressions: initial and active heartbeat late success/rejection, plus runtime cleanup failure while heartbeat remains pending. Fix by retaining and draining the exact heartbeat promise before holder finish, without delaying prompt work abort or accepting late readiness.
- [x] Three additional compatibility tests preserve timely in-flight heartbeat success and awaited late finish persistence success/rejection, with no retry. Supervisor suite 16 PASS; total Node 120 PASS. Build/typecheck PASS; regular Python 21 PASS / 3 optional-native SKIP; isolated Kurigram 24 PASS; real Mongo 8 SKIP without configured target; lint absent. Deferred registry doubles are not real network/database crash evidence.
- [x] Local subprocess cleanup concurrency/escalation slice delivered below; full unknown native-group/host cleanup remains unverified. No live Telegram/Render playback, host cleanup attestation, automated safe-unquarantine or clone onboarding is claimed.

A heartbeat/finish that never settles intentionally keeps the run pending. This closes early holder completion for heartbeat races, not bounded drain or full crash recovery. Terminal relay real-Mongo acceptance, serialized runtime delivery, complete runner audits and pre-persistence event loss remain open.


### Single-flight child cleanup checkpoint

- [x] Active-branch preflight again found recreated local history at the base with implementation files untracked. Fetched the same branch, compared all 76 remote-tracked files byte-for-byte (no differences), fast-forwarded local history and restored tracking without changing file contents. Reviewed all eight Markdown documents and retained prior scope/gates.
- [x] Three real-process RED regressions: concurrent shutdown disrupted a pending leave; repeated shutdown lost the original result; concurrent closes did not share a reap operation. Memoize exactly one shutdown result and one close promise per child. Repeated failure cannot become success.
- [x] POSIX subprocess evidence: acknowledged shutdown reaps a same-group descendant; SIGTERM-resistant child requires the existing two-second SIGKILL escalation. PID/group disappearance checked. Real runner with in-memory queue/leases retains assistant ownership and never releases after forced exit. These fixtures do not speak to Telegram or prove native cleanup.
- [x] Targeted transport suite 13 PASS; `npm run check` build/typecheck + 126 Node PASS, regular Python 21 PASS / 3 optional-native SKIP; locked isolated Kurigram 24 PASS; Mongo 8 SKIP without configured target. No lint script; no live Telegram/Render validation.
- [x] Bounded post-reap process-group observation/error classification delivered below. Escaped descendants, actual native/host cleanup attestation and conservative release reconciliation remain blockers. Do not equate a completed signal/reap of the immediate child with cleanup of every possible descendant.

No controller/onboarding, arbitrary media sources, decorative frontend or new cloud dependency was introduced. Real Mongo relay/CAS acceptance, durable runner audit delivery, pre-persistence terminal loss and live Phase 0 gates remain open.


### Bounded post-reap group observation checkpoint

- [x] Reviewed all eight Markdown documents, branch/source/test state and preserved the current A–Q scope and safety gates. Local Git tracking was restored only after all 77 remote tracked files matched byte-for-byte; no workspace contents were discarded.
- [x] Before implementation, observed missing-helper RED and two behavioral RED regressions: one-shot group probe rejected delayed disappearance, while a swallowed signal permission error allowed a clean result. Added monotonic bounded observation and explicit unknown/error classification; only ESRCH proves original-group absence.
- [x] Cache group evidence with the single-flight close. A two-second post-reap observation timeout, unknown probe or non-ESRCH signal error cannot authorize clean shutdown. No detached probes, old-identity re-probe, retry playback or safe-unquarantine endpoint.
- [x] Targeted group/transport suite 25 PASS (7 helper tests, 18 transport tests). `npm run check`: build/typecheck + 138 Node PASS; regular Python 21 PASS / 3 optional-native SKIP. Locked isolated Kurigram 24 PASS. Mongo 8 SKIP without configured service. Dependency audit 0 known production advisories; lint unavailable.
- [x] New IPC admission at shutdown is fenced in the following checkpoint while retaining the internal leave/cleanup path. Host process-tree/cgroup policy, escaped descendants, verified native/remote cleanup and real Mongo/Telegram/Render acceptance remain blocked/unverified. The post-reap timer is not bounded whole-host shutdown or cleanup of an unkillable child.

New OS failure cases use injected syscall outcomes with real local transport children, not privileged live EPERM/native-call experiments. Onboarding, public clone lifecycle and frontend remain gated; full clone/settings/group/plugin/web scope is retained.


### Shutdown admission and Docker test image checkpoint

- [x] Preserved the interrupted shutdown increment: two RED admission regressions then synchronous public admission fence/private internal leave; four added tests cover normal shutdown, microtask calls, pending IPC and unbound child. No caller bypass for a forged leave operation.
- [x] User requested Dockerfile/complete bot. Added multi-stage operator image, selected native lock, FFmpeg, non-root user and tini signal forwarding; compiled Node entrypoint needs no dev dependencies. Three static container contract tests observed RED before files existed. Added `.dockerignore` and existing README Docker/Render instructions including non-idempotent enqueue/restart warning. No paid resource or deployment created.
- [x] Reviewed all eight Markdown plans and retained full bot/factory/multiple-bot/settings/plugins/groups/web scope. `npm run check`: build/typecheck and 145 Node PASS; regular Python 21 PASS / 3 optional-native SKIP; isolated Kurigram 24 PASS; Mongo 8 SKIP without target; no lint script.
- [ ] Docker image build/native smoke/Render test remains NOT RUN: no Docker engine here. Static contract tests do not establish OS ABI/FFmpeg/Telegram compatibility. Docker tags/OS packages are not immutable digests; record resolved versions when building. Provision fixtures/credentials/database records outside source.
- [ ] Next gate: build/run the container on an approved Docker host and perform disposable real-Mongo acceptance, then operator-controlled live Phase 0. Runtime lifecycle/restart reconciliation, host/escaped-descendant cleanup, complete audit coverage, authenticated controller/factory, Telegram command UI and subsequent required scope remain unfinished. The image is not a complete bot; onboarding remains disabled.


### Owner VC / WebApp preference checkpoint

- [x] User explicitly requires owner-selectable original Telegram VC or independent Playeon-like WebApp playback. Added this as required per-bot destination scope, not an optional replacement of VC or permission to copy upstream. No WebApp playback readiness claim.
- [x] Observed missing-repository RED before implementation. Added durable desired preference on the existing bot document, strict `vc|webapp` validation, owner/non-suspended scope and majority-acknowledged revision CAS. No upsert, URL field, automatic retry or ownership reset. Legacy bots default to VC; malformed state fails closed.
- [x] Wired startup admission into the real operator runner before queue/assistant access: WebApp selection fails explicitly rather than starting VC. Existing playback isn't hot-switched. Trusted-operator inspect/request CLI added; it is not an authenticated owner Telegram menu. Desired state remains unapplied; no false runtime acknowledgement or full history claim.
- [x] Ten local preference tests cover tenant denial, suspension, concurrent/stale writes, malformed inputs/state, ambiguous/unacknowledged writes and VC/WebApp separation. Added real-Mongo acceptance test, NOT RUN without target. Build/typecheck + 155 Node PASS, regular Python 21 PASS / 3 optional-native SKIP; isolated Kurigram 24 PASS. Mongo 9 SKIP; no lint script.
- [ ] Next: validate real Mongo and container/live VC acceptance, continue conservative ownership/restart recovery, then authenticated owner mode controls and WebApp initData/session/media backend followed by independent 2D browser player. No public UI/backend or WebApp playback implemented in this increment. Complete desired/applied settings/outbox/history remains required.

The requested WebApp player is not delivered by storing a preference. Do not expose unauthenticated media or silently start VC to make it appear available. Existing Docker build/Render/Telegram blockers, all clone/group/plugin/web scope and onboarding gates remain intact.


### Direct Playeon personal-test copy checkpoint

- [x] User requests actual Playeon clone for testing rather than waiting for independent implementation; copied pinned source under isolated `vendor/playeon` with original attribution/license, provenance and original hashes. No replacement of credits, commercial integration or discarded platform work. The ignored inspection clone remains separate.
- [x] RED provenance check before vendoring; RED syntax regression and failed real bot typecheck / web build before patching. Two root tests verify baseline/local patch integrity, attribution, privacy syntax and no build-time Google Fonts. Five upstream files intentionally changed; Next/eslint-config-next 16.4.6 and non-force audit fixes locked.
- [x] Actual upstream bot typecheck PASS and WebApp production build PASS. Both full component dependency audits now report 0 known vulnerabilities (previously both included critical advisories). Web lint remains FAIL: 4 errors / 11 warnings; no disabling rules. Root build/typecheck + 157 Node PASS; regular Python 21 PASS / 3 optional-native SKIP. Mongo 9 SKIP without target. Isolated native Python was not rerun for this upstream-only slice.
- [ ] No live bot, Telegram audibility, database connection, Render deployment or production hardening acceptance. README provides private setup with own origins/secrets and explicit development-bypass/default-host warnings. Root Dockerfile is NOT the Playeon deployment. Vendor rooms do not inherit platform isolation/lease/mode guarantees; native VC integration is not delivered by this copy.
- [ ] Next personal-test slice: address upstream lint errors, review authorization/media/logging defaults and validate private disposable database/Telegram/browser session under operator supervision. Existing independent platform/multi-bot/settings/VC/WebApp requirements remain, but do not call this vendor copy a completed multi-tenant production bot or use it commercially without permission.

Vendor import review: staged credential-pattern/local-link checks pass; no dependency/build artifacts included. Non-vendor diff whitespace check passes; full check flags inherited whitespace in eight unchanged upstream files (documented, not suppressed/reformatted).


### Render split-service test Blueprint checkpoint

- [x] User wants this repo deployable on Render while retaining the ultimate planned platform. Added root Blueprint with two explicit Docker services, bot persistent session disk, health paths, runtime shared secret bindings, single-instance/off-auto-deploy defaults. Paid service/disk costs require operator review; no resources purchased or deployed.
- [x] Observed missing deployment-module RED before implementation. Seven local tests verify validation, auth-bypass/URL/secret/identity rejection, port/admin checks, Docker/Blueprint contracts, no native assistant config or replay arguments, and preserved root VC Dockerfile. Mounted disk bootstrap drops privileges before bot execution; web runs non-root; source-discovering bot retains tsx and builds native SQLite dependencies. Docker context excludes nested build outputs/logs.
- [x] README now gives concrete Blueprint branch selection, inputs, origin/rebuild procedure and BotFather `room` app configuration. Reviewed all eight Markdown documents; no factory/settings/VC/WebApp/group/plugin scope removed. No new changes to vendored source or credits.
- [x] Build/typecheck + 164 Node PASS; regular Python 21 PASS / 3 optional-native SKIP; Mongo 9 SKIP. Seven targeted deployment tests PASS; shell syntax PASS; actual startup validator rejects absent config without values. YAML parsing PASS; actual Render API/schema/image deployment NOT RUN. Vendor bot module import succeeds offline; prior vendor typecheck/web build evidence unchanged. No root lint script; vendor lint remains 4 errors / 11 warnings.
- [ ] Next: run Docker builds/native SQLite startup on an approved Docker host, verify Blueprint through Render, then a private test with real Mongo/Redis/Telegram initData/media/network/termination checks. Existing URL-token transport/logging/auth/recovery issues block broader production exposure. This deploys browser playback only; full mode application/acknowledgement and Python VC integration remain unfinished. Do not present templates as completed platform acceptance.


### Full application in one Dockerfile checkpoint

- [x] User rejects a partial/split deployment and requests the full clone startup. Added root `Dockerfile.bot` for the complete vendored bot + Next WebApp + gateway, with single-service Render Blueprint. Prior split configuration remains available as an alternative, and the native-VC prototype is untouched. No upstream source/credit edits.
- [x] Observed missing root Dockerfile RED before implementation. Environment template/README now enumerate exact inputs, public build arguments, single URL, persistent disk, command defaults and BotFather named `room` setup. Defaults cover session/DB name/caps; no assistant session or worker grant required for upstream browser playback.
- [x] Gateway distinguishes HTTP `/room` from WebSocket `/room`, proxies authenticated media/preview/avatar endpoints, disables proxy buffering/access logs. Supervisor aggregates health from both services over bounded HTTP requests, rejects conflicting internal ports, drops app privileges, drains immediate services on signal/failure with escalation. No seamless recovery or descendant cleanup assertion.
- [x] Build/typecheck + 170 Node PASS, regular Python 21 PASS / 3 optional-native SKIP; Mongo 9 SKIP. Five new full-deployment tests include actual loopback health responses plus config/image/gateway contracts. Existing deployment tests updated for intentionally combined service; root image/provenance checks preserved. No root lint script; inherited web lint remains 4 errors / 11 warnings.
- [ ] Docker image, native SQLite/session creation, Nginx syntax/WebSocket/range transport, real database/Telegram/Render acceptance are NOT RUN without engine/credentials. Single-container packaging is not proof of production readiness, owner mode integration, bot-factory/clone safety or native VC. Existing full scope and original license remain intact.


### Reported VC Docker build directory failure checkpoint

- [x] User supplied a real build failure: root Python-VC image reached `mkdir /media` on a base with that directory already present. It was not building `Dockerfile.bot`. Reproduced the existing-directory failure RED by executing the actual extracted shell mkdir step in a disposable directory.
- [x] Changed only that step to `mkdir -p /media`; retained non-root execution/ownership and distinct all-in-one deployment path. Regression proves absent directory creation, existing directory/content preservation, and regular-file collision rejection (no blanket error suppression).
- [x] Four container tests PASS; root build/typecheck + 171 Node PASS; regular Python 21 PASS / 3 optional-native SKIP. Mongo 9 SKIP without target. Docker engine absent, so full image rebuild NOT RUN. Isolated Python/native suites not rerun for a filesystem-only Docker fix; no root lint script.
- [ ] Operator must select `Dockerfile.bot` in Render for full cloned bot/WebApp, correct branch/latest commit and repository-root context; README provides exact troubleshooting. The root VC image remains an operator prototype even after this build fix. Real all-in-one image/Nginx/database/Telegram/Render acceptance and existing safety/security/lint gates remain unverified.


### Default full-application image checkpoint

- [x] User's subsequent Render log confirms the `/media` build fix succeeded but the old root native-VC operator runner exited with its generic failure. Do not infer specific DB/auth/lease failure from that sanitized message. Supplied public app origin is `https://multi-musicbot.onrender.com`; no live endpoint probe/deployment modification performed.
- [x] RED default-image regression before implementation: root file lacked full app build stages. Root `Dockerfile` now builds/starts bot+WebApp+gateway; old root image preserved unchanged as `Dockerfile.vc`, including the mkdir fix. `Dockerfile.bot` compatibility copy must match the new default byte-for-byte. Blueprint selects root default. Existing VC and directory tests target the explicit opt-in file, not removed/weakened.
- [x] Public origin supplied as build/runtime/Blueprint/template default; bot username still required at build, credentials never embedded. Startup marker distinguishes full app from operator runner; build error explains public fields without values. README corrected current native-vs-default paths and gives exact existing-service recovery and BotFather URL.
- [x] Build/typecheck + 172 Node PASS; regular Python 21 PASS / 3 optional-native SKIP; real Mongo 9 SKIP without target. No root lint script; inherited vendor lint unchanged. Full image execution, Nginx/WebSocket/native session, live database/Telegram/Render acceptance remain NOT RUN without Docker/services. No isolated Python native rerun for packaging-only change.
- [ ] Operator must deploy latest active-branch commit with default Dockerfile, correct secrets/disk/health check and no stale command override. Existing public-room security/recovery/lint gates, native VC integration and full multi-tenant platform remain unfinished.


### Sole Dockerfile and logging-source build fix checkpoint

- [x] Completed the interrupted explicit cleanup: removed four alternate Dockerfiles, split YAML and two unused startup scripts. Root `Dockerfile`/`render.yaml` remain the only deployment path. Source, upstream credits/provenance, native voice and ownership tests are preserved. Updated active README/env template; older checkpoint filenames are historical, not current instructions.
- [x] Real Render build now selects correct app but reports eight TS2307 logger imports. Added three RED regressions before fixes: source lost under Docker filtering, source-vs-runtime log filtering and extra Dockerfiles. Removed broad `**/logs`; runtime directories/files, secrets and generated artifacts stay excluded. No fake logger modules or compiler bypass.
- [x] Reconstructed Docker-filtered bot source and ran actual compiler: old rules reproduce all eight exact missing modules; new rules typecheck successfully. Docker-compatible matcher is a dev-only Apache-2.0 dependency with zero runtime dependencies; production app/package locks unchanged. Tests check every pinned upstream bot/web source path; existing image/directory/privilege/signal tests now target retained full-app behavior.
- [x] Root build/typecheck + 175 Node PASS; regular Python 21 PASS / 3 optional-native SKIP; Mongo 9 SKIP without target. No root lint script; inherited web lint remains unchanged. Docker engine unavailable, so full image/Nginx/native session/Render/live database/Telegram execution remains NOT RUN. No new Python isolated-native run for context-filtering/deployment-only changes.
- [ ] Redeploy latest branch commit using sole root Dockerfile. No environment/credential changes required for these missing modules. Broader production, token-transport/auth/logging/recovery and native VC/multi-tenant integration gates remain unresolved.


### Current delivery evidence — shutdown-fenced readiness

- [x] Preflight detected recreated Git metadata at the initial commit. Compared all 378 remote tracked files byte-for-byte (identical), restored active-branch tracking/history without changing workspace contents, and reviewed all eight Markdown documents. Sole Dockerfile policy, supplied Render URL and source-context regression remain intact.
- [x] Observed two behavioral RED regressions through actual local HTTP: a blocked healthy probe completed after shutdown but returned 200; rejected probe escaped the handler. Extracted the existing handler into the deployment helper, then fenced before/after await and converted probe failures to sanitized HTTP 503. No caching or late readiness restoration.
- [x] Four local HTTP tests PASS (controlled downstream promises, not real Telegram/native processes). Root build/typecheck + 179 Node PASS, regular Python 21 PASS / 3 optional-native SKIP; Mongo 9 SKIP without target. No root lint script; inherited upstream lint unchanged. No Python/native rerun for this JS-only increment.
- [ ] Actual Docker/Nginx/Render/database/Telegram acceptance and full image process-lifecycle/crash tests remain unverified without engine/services. HTTP readiness is not native cleanup, playback confirmation, bot-factory integration or production certification. Existing platform/VC/WebApp/security/recovery scope is retained.
