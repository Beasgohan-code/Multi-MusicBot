# Architecture specification

Status: target architecture with a partially implemented Phase 0 prototype; implementation audit and safety gates are recorded below. This specification and PHASE_0_ACCEPTANCE.md supersede conflicting voice-adapter preferences in earlier planning notes. Repository: Beasgohan-code/Multi-MusicBot; no new repository is needed.

See [MASTER_ROADMAP.md](MASTER_ROADMAP.md) for the full A–Q scope and staged acceptance gates.

## 1. Decisions

- TypeScript/Node.js (currently tested on 22; validate 24 before adopting it) and Telegraf for controller, worker bot command handling, moderation, and authoritative queue orchestration.
- MongoDB Atlas for durable tenant state. Official driver, bounded connection pool, versioned schema/index migrations.
- FFmpeg for media processing. Use permitted local audio for the first voice experiment, not source extraction.
- Render paid Docker background worker is the target candidate; actual voice connectivity and sizing remain unproven.
- Python/PyTgCalls is the initial voice direction under the latest master blueprint. Isolated tests selected Kurigram 2.2.26 / PyTgCalls 2.3.3 / ntgcalls 2.2.5; Wzgram 3.1.7 failed compatibility. Select one MTProto distribution per assistant runtime. Installed baseline versions are pinned; live/Render validation remains pending. The earlier Node-first experiment is no longer the primary plan; no Node-native voice bridge is used.
- One active call per assistant initially, one initial assistant, explicit busy response. Assistant allocation is required in the first music release, not postponed until scale-out.
- Main bot and worker bots share moderation/music modules; main bot additionally exposes private platform controls. Tenant owners do not inherit group-admin authority.
- Target onboarding supports multiple independent bots per owner within persisted plan limits. Keep initial rollout invite-only and capacity-limited by measurements; do not encode one bot per owner as a permanent unique index. Billing/web remain later gates, not omitted platform systems.

## 2. Runtime boundaries

```text
Telegram Bot API
  ├── controller identity
  └── registered worker identities
             │ long polling: one consumer/token
Node process: controller + runtime supervisor + permission policies
             + moderation + durable jobs + queue authority
       │                               │
MongoDB Atlas                 bounded private IPC
                               voice child process
                               assistant MTProto client
                               call transport + FFmpeg
```

Both processes run in one container initially. This provides native voice crash containment, not hard tenant CPU/memory isolation. A top-level supervisor forwards signals and reaps children; essential process failure must yield a bounded restart or a nonzero container exit, never an orphaned half-running deployment. Music health and moderation health are distinct. A voice-only failure must not trigger a blind restart of every bot.

The voice child holds no worker bot tokens and does not consume Bot API updates. It receives only the assistant session required for its configured slot; no secrets in command-line arguments. Never start GramJS and Kurigram simultaneously against the same assistant as competing engine owners.

## 3. Module ownership

| Area | Owns | Must not own |
|---|---|---|
| controller | registration, My Bots, credentials rotation, lifecycle intent | arbitrary group sanctions |
| bot-runtime | Telegraf instances, per-bot error containment, desired/observed state | duplicate pollers |
| permissions | platform owner, tenant owner/co-manager, group admin, DJ, member checks | role inference from callback payloads |
| moderation | rules, notes, greetings, warnings, sanctions, durable expiry | global bans without explicit platform scope |
| queue | per-bot+group serialized mutations, revisions, playback intents, snapshots | native audio stream state |
| voice adapter | assistant readiness, observed calls, transport acknowledgements | independent authoritative queues |
| assistant broker | fenced lease allocation, capacity, stale-runtime reconciliation | unlimited call promises |
| media | bounded source resolution, local trusted handles, FFmpeg presets | arbitrary shell execution |
| database | tenant-scoped repositories, indexes/migrations | trusting submitted ownerId as authority |

## 4. Voice adapter contract v1

Use versioned JSON messages over a Unix socket or framed stdin/stdout. Choose one framing implementation during the spike; cap frame size and apply backpressure/timeouts. Logs go to stderr, not protocol stdout. No public voice endpoint.

Request fields: protocolVersion, requestId, botId, chatId, sessionId, assistantLeaseGeneration, expectedRevision, operation, validated payload. Supported first-spike operations: health, prepare/join, start-local-media, pause, resume, switch-local-media, stop, leave, reconcile. Commands refer to allowlisted media handles, not arbitrary filesystem paths or remote URLs.

Event fields: protocolVersion, eventId, requestId when applicable, sessionId, leaseGeneration, sessionRevision, eventType, sanitized result/error. Events: accepted, playback_started, paused, resumed, media_ended, left, failed, disconnected, heartbeat.

Accepted means queued, not audible. Mark a track playing only after engine start confirmation; verify audibility with a human in the smoke test. Drop old generations and duplicate events. Define idempotency per operation/session; use reconciliation for uncertain outcomes rather than replaying a non-idempotent skip. Bound retries and stop processing after lease loss. Lease fencing must reach the active adapter command validator; a DB expiry alone cannot stop a stale native stream.

## 5. State and failure semantics

- Worker lifecycle: registered → starting → running → stopping → stopped; error/suspended/deleting are explicit. Runtime state never replaces persisted operator intent.
- Playback: idle → preparing → playing/paused → ending → idle; failed/interrupted preserve safe diagnostics and metadata.
- Serialize group actions by botId+chatId, with persisted revisions and capacity checks. Only one hosted music-controller binding per group.
- Write command intent before executing external work. Store outcome and deduplicate retries. Do not claim atomic transactions across Telegram, MongoDB and FFmpeg.
- On host restart: reconcile assistants and leases, mark interrupted streams, offer upcoming snapshots. No automatic replay of the interrupted track. Explicit admin restoration after fresh playback.
- Brief network reconnect may reconcile the same live session within a bounded window; uncertain/stale sessions are stopped. This differs from host-restart recovery.
- Moderation expiry jobs check sanction version; an old unmute job must not undo a newer mute. TTL is cleanup, not a scheduler.
- No worker hibernation while moderation is enabled. Idle voice disconnect is separate from stopping a bot poller.

## 6. Database boundaries

Canonical initial collections follow PLAN.md and the reconciliation mapping: owners, bots, groups, group_bindings, djs, warnings, notes, playlists, plays, assistants, call_leases, jobs, audit_events; music_sessions, music_queues, queue_snapshots and music_commands are added with core music.

Separate bot_secrets/assistant_secrets from ordinary settings before tenant onboarding. Store ciphertext, nonce, auth tag and key version; encryption key only in deployment secrets. Secret repositories are operator/runtime-only and never serialized into dashboard responses. This refines earlier inline encrypted-token sketches.

Use botId as mandatory tenant partition key on tenant-owned records; ownerId is additional ownership metadata, not an alternative tenant boundary. IDs stored consistently as strings. Unique bot identity, group binding, per-tenant names and assistant slot leases; index query predicates and retention dates. Use schema validators and migration versions. Control document sizes and playlist lengths.

Ownership transfer/config import/export are deferred: design confirmation by both parties, snapshot/version checks, transaction boundaries on a compatible deployment, and post-transfer authorization invalidation before enabling them. Exports never contain credentials. Cross-clone library sharing is explicit opt-in, not the default.

## 7. Roles and onboarding safeguards

Platform operator manages infrastructure and suspensions. Tenant owner manages their bot. Co-manager permissions are explicit and exclude credential/ownership operations by default. Group admins authorize group configuration/moderation. DJs control permitted music operations only. Members request tracks subject to group settings; guests receive no implicit access.

Worker registration attaches an existing BotFather identity; it does not create a Telegram identity. Validate with getMe, reject duplicates/controller token, detect existing webhook and require explicit migration consent. Changing display branding is subject to supported Telegram APIs; username ownership/changes remain a BotFather action, not a promised runtime feature.

Local Phase 0 uses environment secrets and local session login, never a chat-submitted OTP/password. Hosted token submission later needs disclosure that bot chats are not end-to-end encrypted, best-effort deletion, redacted logs and encrypted storage. No raw-secret operator commands.

## 8. Repository layout

Use an incremental monorepo, creating directories only when functional code exists:

- apps/control-plane/src — private platform commands, authentication, bot factory, clone manager and settings; create modules when executable code exists.
- apps/bot-runtime — lifecycle, polling, shared moderation/music handlers.
- apps/voice-engine — existing Python/PyTgCalls implementation and private IPC; do not relocate merely to match a tree.
- packages/config, shared, database, permissions, security, queue, observability — extracted modules with real consumers/tests, not empty scaffolds.
- tests/unit, integration, voice — contract/policy tests and opt-in real Telegram smoke tests.
- infrastructure and docs — deployment/protocol/runbooks as needed.

Keep the current npm lockfile/build; adopt workspace packaging only when real separately built packages justify it. A monorepo is not a reason to add a framework or distributed queue before the first successful call. First-party plugins must have validated config, handlers, permissions, persistence and tests. No tenant-supplied executable plugin code.

## 9. Release order

Phase 0 voice/protocol feasibility → controller registration → clone lifecycle → minimum moderation → core music with allocation/recovery → expanded music → hardening. Owner controls, logs, permission tests and unit tests ship alongside their features, not only in a final phase. Backups, ownership transfer, scheduling, billing, public registration and web remain separately gated enhancements.

References are architectural inputs only. See VIDEL0_RECONCILIATION.md for inspected source evidence and feature mapping. Verify reuse permission and dependencies before extraction. Nothing here asserts production health, proven Render networking, or a measured bot/call capacity.


## 10. Current repository audit and target mapping (2026-11-15)

This is the implementation map, not a claim that the target services already run. Preserve current imports and executable voice paths until a tested refactor provides a functional benefit.

| Existing files | Target ownership | Verified / missing |
|---|---|---|
| `apps/bot-runtime/{playback-runner,queue-events}.ts`, `packages/queue/state.ts` | Runtime playback coordinator + authoritative TS queue domain | Local tests cover controls, end/skip races, recovery metadata; no complete crash-safe supervisor |
| `apps/bot-runtime/{voice-process,python-child}.ts`, `packages/shared/protocol.ts` | Runtime transport + future `contracts/ipc` | Versioned framed private IPC, bounded single-flight commands; no public voice API |
| `apps/voice-engine/{server,runtime,native_adapter,lease_deadline,protocol}.py` | Python execution/adapters/IPC | Offline adapter/runtime/deadline tests; actual audibility and cleanup remain unverified |
| `packages/database/{queues,leases}.ts` | Scoped repositories + assistant broker persistence | Queue CAS and server-time lease guards; abandoned native holders remain quarantined, not safely reconciled yet |
| `packages/security/vault.ts`, `packages/database/secrets.ts` | Credential security + factory secret storage | Encryption and scoped reads tested; credential storage alone is not bot registration or ownership authentication |
| `packages/database/workers.ts` | Registry persistence used by operator supervisor | Grant-authenticated claim/heartbeat and holder/generation/token-fenced finish; wired to operator playback, not a full controller |
| `packages/bot-ui/{index,custom-emojis/catalog}.ts` | Rich shared presentation | Emoji catalogue, surface policy, escaping and six templates; no live Telegram handler migration |
| `packages/observability/audit.ts` | Safe audit persistence | Whitelisted runner sink remains separate; ownership transitions and terminal queue receipts now have atomic journals/relays |
| `scripts/run-playback.ts` | Restricted Phase 0 operator tool | Connects Mongo + runner + Python; authenticated operator execution guard; not an approved concurrent fleet deployment |
| No implementation yet | Control-plane factory, clone services/settings, permissions, plugins, web and realtime | Required target systems below; do not fill folders with placeholders |

### Safety gate before clone execution

Worker registration authentication is a necessary foundation, not proof that Phase 0 dependencies are safe. Remaining blockers are late-settlement/cancellation of timed-out operations, trusted cleanup/reconciliation after host loss, durable terminal persistence and transition audit, full supervisor exit/restart handling, real Mongo failure testing and real Telegram/Render acceptance. Do not turn on concurrent fleet operation, automated migration/restart or public token onboarding before these are resolved.

Worker grants are operator-provisioned, high-entropy secrets stored as hashes. Renewal authenticates the same grant, bot/owner, holder and generation and checks server-time expiry. Revocation/suspension checks happen before renewal; multi-collection checks still have a race with concurrent revocation. The operator supervisor fails closed on renewal errors and aborts/drains; bounded host cleanup/escalation and full lifecycle policy remain unfinished. Expired or quarantined workers cannot be claimed. Existing active records without `grantHash` fail closed after this change; do not backfill live holders or reset them to stopped without cleanup evidence. `finish(clean)` is trusted-supervisor-only, never a tenant-supplied cleanup assertion.

## 11. Bot factory and clone control model (required target)

The factory attaches an existing BotFather identity using getMe, validates controller/duplicate identity exclusions and webhook migration consent, and selects a versioned configurable template. Token ownership verification is not equivalent to authenticating the submitting platform user. Authentication must produce a trusted actor before any repository operation.

Create registration intent, plan reservation, bot record, initial configuration/history, encrypted secret reference and worker slot within a transaction on a supported Mongo deployment. Unique Telegram bot identity and idempotent request identity prevent double registration. Enforce multiple-bot plan limits through a server-owned entitlement/capacity record updated atomically, never count-then-insert or a client-submitted limit. Telegram verification occurs outside Mongo transactions; failures/retries must release reservations without exposing tokens. No automatic BotFather account creation is promised.

The clone manager owns desired lifecycle/configuration and deployment versions, not native audio state. Lifecycle requests start/stop/restart/deploy persist intent first, with authenticated actor, request ID and expected revision. Workers report observed state with worker generation and intent correlation. Stop/restart waits for queue interruption, native cleanup/reap and poller exit; an uncertain step quarantines the clone/assistant rather than reporting success. Migration drains the old holder before a new holder can claim; DB expiry alone is not migration evidence.

A clone has independent profile, administrators/team memberships, groups, group permissions, music/DJ policies, plugin installations/configuration, assistant assignments, logs, analytics and backup history. Team capabilities are explicit and bot-scoped; team membership does not grant credential export, ownership transfer or Telegram group-admin powers. Every API, callback, job and worker message enforces its own actor/resource scope. Hidden frontend actions are not authorization.

## 12. Settings lifecycle and customization (required target)

Settings are typed, bounded and schema-versioned; unknown fields are rejected. Templates supply validated defaults, not executable tenant code. Separate secret references and entitlements from ordinary editable settings. Apply optimistic revisions and retain actor/change history, excluding secret values.

| Settings module | Examples | Application boundary |
|---|---|---|
| General/identity | Display profile, description, branding | Supported Telegram profile APIs with observed result; unsupported username operations remain BotFather tasks |
| Commands/menus | Command sets, menu behavior | Capability/role-checked Telegram updates; disabled plugin commands removed |
| Music | Playback defaults and allowed sources | TS admission policy + validated Python execution arguments |
| Queue/autoplay | Bounds, fairness, autoplay policy | Authoritative TS queue; never a second Python queue |
| Audio/effects | Quality presets, bounded effects | Capability-checked next-track or explicit safe restart; reject unsupported settings |
| DJs/approval | Roles, request and vote policy | Re-evaluate permissions at action execution |
| Group management | Moderation policy and group overrides | Requires actual Telegram group authority as well as clone access |
| Assistants | Pool eligibility, assignment policy | Broker-controlled assignment; no tenant editing of live lease generations |
| Plugins | Enabled state, validated configuration | Disable prevents command registration and job dispatch/execution |
| Language/timezone | Locale, IANA zone | Shared presentation + timezone-aware scheduling |
| Notifications | Events, destinations, quiet periods | Authorized destinations and bounded delivery jobs |
| Premium entitlements | Plan capabilities and usage limits | Server-owned, not owner-editable flags |
| Security/access | Team roles, allowed actions | Immediate authorization invalidation where possible |
| Runtime/deployment | Approved version, resources, desired state | Operator-approved values; drain/restart lifecycle, not arbitrary shell input |

Persist desired revision and worker-observed applied revision separately. Validate before saving, publish durable application intent/outbox, apply only to the matching clone/generation and acknowledge exact revision. Failure leaves a visible pending/failed state, never a fake applied flag. Classify each change as hot-applicable, next-track, requires restart or operator-only. Rollback creates a new revision; it never rewrites history. All of this remains unimplemented beyond existing queue controls.

## 13. Rich UI and workspace boundaries (required target)

`packages/bot-ui` must own safe formatting, cards, keyboards, menus, pagination, progress and localization once implemented. Extend the existing emoji/surface policy rather than copying presentation into handlers. Target Now Playing cards, queue tables/pages, interactive settings, confirmation/error cards, group/user cards and progress indicators. Dynamic HTML/Markdown must be escaped for the actual parse mode; plain-text fallback must not contain markup. Pagination and mutations use scoped short callback references, reauthorize on every click and reject stale revisions.

Expandable blockquotes/collapsible content, native button icons and Mini App buttons are method/client/capability-dependent: use an explicit capability policy and supported alternatives. Do not copy Python Richgram into TS or assume it changes Telegram's API limits. Message/caption length and UTF-16 entity offsets need tests before richer cards. Current implementation only supplies HTML message templates, Unicode buttons/toasts and emoji rendering; Markdown, tables, collapsible cards, Mini Apps and interactive menus remain missing.

The web is a later application sharing backend use cases, not a second source of business rules:

- **Platform workspace:** overview, fleet, clone creation, deployments, workers, assistant pool, plugins, subscriptions, usage, logs, analytics and platform settings.
- **Clone workspace:** overview, profile, general/music settings, queue/player, groups, DJs, assistants, plugins, analytics, logs, backups, security and deployment.

Every clone route resolves authorized membership and bot scope server-side. Authenticated Mini App init data is verified server-side with replay/age checks. Realtime subscriptions reauthorize tenant/room access; browser state is not playback authority. Neither workspace exists yet; no frontend placeholder action may claim backend success.

## 14. Mongo model/index/migration target

Use one canonical identity per concept; do not duplicate `call_leases` alongside the existing leased `assistants` collection without an explicit migration. Each tenant-owned collection requires bot scope and relevant ownership predicates. Bot identities and actor IDs remain strings. No TTL index releases assistants or workers.

| Model / collection | Required keys and indexes | Current state |
|---|---|---|
| Owners/entitlements/usage | Owner identity; plan/capacity revision; unique owner+period+metric counters | Missing |
| Bots / encrypted secrets | Unique botId; owner+bot lookup; secret refs never public | Secret repository exists; full bot model/registration missing |
| Bot configurations / versions | Unique botId+revision; schema/template versions, desired/applied revision | Missing |
| Deployments / lifecycle intents | botId+requestId unique, botId+createdAt; desired/observed worker generation | Missing |
| Worker grants / workers | Unique token hash / botId; scoped holder+generation+hash updates | Internal repository exists; schema validators/provisioning/migration missing |
| Groups / group bindings | Scoped botId+chatId; explicit platform-wide active binding constraint | Missing |
| Memberships / DJs | Unique botId+userId+resource scope, explicit roles/version | Missing |
| Assistants / assignments | Unique assistantId; active chat exclusivity; assignment botId+assistantId | Leases exist; assignments, account readiness and reconciliation missing |
| Plugin installations | Unique botId+pluginId, validated config/version and enabled state | Missing |
| Queue / playback state | Unique botId+chatId, CAS revision and correlated source | Existing repository; full crash recovery still missing |
| Events / outbox / audit | Scoped event identity; botId+time; delivery/dedup status; safe payload | Runner audit sink plus atomic ownership and terminal journals; bounded operator relays, not full event coverage |
| Backups | botId+backupId, schema/config revision, retention and encrypted storage ref | Missing; exports must exclude credentials and active leases |
| Usage / analytics aggregates | Scoped metric+period keys, idempotent settlement source IDs | Missing |

Implement validators and named idempotent migrations with schema versions, preflight duplicate detection and safe failure, not silent destructive repairs. Multi-document registration/config/outbox changes require transactions and a supported replica set. Integration tests must verify indexes, validators, races, isolation and rollback against real Mongo. Test doubles alone do not satisfy that gate. Backup restoration validates/imports a new configuration revision, rechecks current entitlements/plugin permissions and never restores active native ownership.

## 15. Incremental delivery policy

Finish Phase 0 safety dependencies first. Then prioritize authenticated factory registration and desired/observed clone lifecycle with multiple-bot quota enforcement, encrypted credentials and versioned template configuration. Next make one real setting round-trip from authorized control action to persisted revision to worker application/acknowledgement. Expand settings/UI/workspaces vertically with behavior tests, not empty directory scaffolds. Plugin disable must be enforced both when registering commands and immediately before executing any queued job. Dashboard, billing and realtime remain gated but explicit parts of the target. Keep every safety/authorization test alongside the feature and update existing acceptance evidence after each increment.

### Implementation update: supervisor and quarantine reconciliation (2026-11-15)

`apps/bot-runtime/supervisor.ts` now guards `scripts/run-playback.ts`: authenticated registry claim precedes queue initialization/playback, expected bot scope is checked, bounded heartbeats run during execution and heartbeat loss aborts the runner. Work must finish cleanup before worker finish; uncertainty or renewal loss quarantines rather than auto-restarts. Raw grants enter only through `WORKER_GRANT`, not IPC/audit or arguments. The runtime holder ID is the registered worker ID. Bot records, grants and stopped slots still require trusted operator provisioning. Registry `ready` here represents the execution guard, not verified Telegram/assistant readiness.

`packages/database/reconciliation.ts` adds operator-internal exact-observation reconciliation methods for expired workers and assistants. Worker state becomes quarantined. Assistants retain state `leased` and all ownership/chat fields, gaining `cleanupStatus=quarantined`, so active-chat exclusivity is preserved. Mutations match bot/holder/generation and server-side expiry. A whitelisted abandonment event is appended atomically to `ownershipOutbox` in the same document. The pending-event bound is 100; overflow fails closed. Events are not a general-purpose metadata/error-string sink.

This is **quarantine reconciliation only**, not complete cleanup/release reconciliation. Bounded operator scanning and ownership/terminal relays now exist; there is no deployed scheduler, trusted remote-host cleanup attestation, complete transition audit or unquarantine endpoint. The operator must not edit quarantined records to idle/stopped. Existing trusted in-process release remains contingent on native cleanup. Late-heartbeat success cannot undo the supervisor's conservative lost-ownership decision; late Mongo/queue operations and drain deadlines still need broader treatment. No onboarded clone or automatic takeover is enabled by this increment.

### Ownership audit delivery and bounded maintenance increment (2026-11-15)

`packages/database/ownership-events.ts` supplies whitelisted aggregation stages for worker claim/heartbeat/finish and assistant acquire/renew/release. Each event is appended inside the same single-document ownership update. Generation is recorded after acquisition increments; release captures tenant/holder scope before clearing live fields. Each mutation checks the 100-event pending bound. Full outboxes fail closed, including release; they are never silently truncated. Normal events use Mongo `$$NOW`; quarantine event creation time is local diagnostic time, while expiry/quarantine eligibility remains server-time guarded.

`ownership-outbox.ts` archives to `ownership_events` with a unique eventId before acknowledging removal from the source. Events keep bot scope after release; acknowledgement matches the source document and exact event ID. Crash after archive/before ack can replay through idempotent upsert. Unknown fields/types and cross-tenant events are rejected, and archive/ack errors propagate. No arbitrary exception payloads, secret refs, tokens or grant hashes enter these events. This closes the atomic ownership-event gap for the currently implemented repository operations, not the separate queue-terminal persistence gap.

`AbandonedOwnership.scan(botId,limit)` is bounded and projects only identifiers/generations before exact CAS quarantine. `scripts/maintain-ownership.ts` exposes a trusted-operator batch using database credentials and a fixed bot binding; it is not a public API and has no release/reset behavior. Supervisor heartbeat/finish paths also relay events. No standalone deployed scheduler is claimed. Host-native cleanup proof, safe unquarantine, full late-operation settlement and live failure acceptance remain open; clone onboarding stays disabled.


### Late native-shutdown settlement contract

A runner cleanup deadline is a failure boundary, not proof that teardown was cancelled. After a shutdown timeout/rejection the runner blocks reuse and observes the underlying shutdown promise to settlement before finishing its run. The supervisor therefore cannot record worker finish merely because Promise.race timed out. Late clean teardown remains conservatively leased/quarantined, not automatically reused. An indefinitely unresolved shutdown intentionally holds the run pending. Other late database mutations, host-level cleanup evidence and bounded native escalation remain separate unfinished work.

### Late acquisition settlement contract

Before a voice child exists, a timed-out acquire must remain attached to its original holder until its promise settles. The runner now captures any known late generation and compensates through the existing exact-holder/generation release; no late result may start playback or replay the request. This is cleanup of a newly acquired **unused** slot, not reuse of an uncertain native session. A rejected/unknown database outcome has no trustworthy generation to release and remains for reconciliation. Failure to compensate leaves the runner blocked, and metadata recovery cannot bypass it. Acquisition that never settles holds the run pending. This supersedes the earlier missing late-acquire handling; renewal, queue/release settlement and native host-crash recovery remain separate gaps.

### Late renewal settlement contract

Failed/timed-out DB lease renewal now blocks the runner and stops native playback before any interruption persistence, without waiting for the underlying renewal promise. The runner retains that exact promise and awaits settlement before release or run completion, even if native cleanup or queue persistence fails. A single memoized shutdown attempt prevents duplicate cleanup calls across these paths. A late DB result never extends the child or restarts playback. Clean teardown plus original holder/generation guards remain mandatory for release; uncertain cleanup stays leased. Concurrent completion is not applied when DB renewal fails, while timely valid renewal still allows exactly one completion. Indefinitely pending renewal intentionally prevents holder finish; late queue/release operations and host-level bounded escalation remain separate gaps.

### Late queue/release settlement increment

Runner retains exact outstanding queue mutations and cleanup release promises beyond their deadlines. Native teardown precedes draining late queue writes; guarded lease release and holder completion wait for settlement, without retries or late success audit. Recovery excludes concurrent run/recovery. Timeout blocks this runner; a late begin/completion may still persist and requires explicit recovery, not replay. Never-settling operations deliberately retain the holder. Durable terminal journaling, host-crash cleanup and real Telegram/Mongo/Render acceptance remain separate gates. Playeon lounge ideas and restrictive licensing are recorded in SOURCE_COMPARISON.md; onboarding and lounge implementation remain gated.

### Terminal acknowledgement truthfulness

A correlated native terminal event alone no longer authorizes a successful runner result or completion/advancement audits. The source-bound queue CAS must report that it applied. If skip, stop, recovery or interruption supersedes the source before persistence, the runner fails closed with `TERMINAL_NOT_APPLIED`, reaps the child, performs exact guarded release only after cleanup, and remains blocked. This is conservative rejection, not reconciliation or a durable terminal journal. Normal successful CAS retries remain bounded and duplicate events do not advance twice. Durable receipt/outbox journaling and real process-crash acceptance remain unfinished; onboarding stays disabled.

### Atomic terminal receipts (bounded first increment)

`QueueState.terminalReceipts` now records each accepted `ended` or `disconnected` transition in the **same queue replacement/CAS** as advancement or interruption. Each receipt contains only outcome type, whitelisted source session/request/generation, track ID and committed queue revision; bot/chat scope is inherited from the enclosing document. There is no separate write between queue mutation and receipt persistence. A rejected/ambiguous acknowledgement does not authorize replay or success: a later scoped read can inspect the committed receipt. These are queue-transition receipts, not proof of native teardown or assistant reuse safety; runner teardown/release gates remain unchanged.

New documents start with an empty journal; legacy absent fields initialize on the next terminal transition, without fabricating past receipts. Recovery and stop retain receipts. Duplicate interruption is rejected. At 100 pending receipts, terminal mutation and new source binding fail closed; evidence is never evicted. The trusted operator relay now archives and acknowledges receipts; without successful maintenance the pending bound still blocks new playback at 100. Do not manually clear records or enable production onboarding around this gate. Archive-before-ack must use tenant scope and queue revision CAS to avoid a concurrent queue replacement resurrecting/deleting receipts.

This closes the receipt gap **for a committed queue transition**, not the crash window before a native event reaches Mongo, the separate runner audit gap, host-crash cleanup, native completion ambiguity, or real Mongo durability/rollback acceptance. Receipt archival is implemented below; conservative reconciliation and real process-crash tests remain required.


### Terminal archive-before-ack relay

`packages/database/terminal-outbox.ts` is wired into `phase0:maintain` as a bounded bot-scoped operator operation. `terminal_events` has a unique botId+chatId+receipt revision index. The immutable receipt content is included in the archive upsert predicate: identity/content collision fails rather than acknowledging mismatched evidence. Only strict minimal receipts are archived; malformed, duplicate-revision and cross-tenant evidence stays pending. No arbitrary metadata/error text is persisted.

Archive and acknowledgement request majority write concern and require acknowledged results; write timeout/unknown outcome never authorizes replay or reported delivery. After archive success, acknowledgement matches bot+chat, observed queue revision and the exact receipt, removes only that receipt revision, and **increments queue revision** atomically. A stale queue replacement therefore cannot resurrect the removed journal. A concurrent writer/relay conflict rejects without claiming delivery; rerun from a fresh read. Archive/ack outages retain evidence and replay uses the same archive identity. The relay does not execute playback, release leases, clear quarantine or assert native cleanup. It is not wired into live heartbeat because changing queue revision concurrently can conservatively interrupt runner CAS; prefer drained operator maintenance until serialized runtime integration is tested. No deployed scheduler or independent worker drain/restart path is claimed.
