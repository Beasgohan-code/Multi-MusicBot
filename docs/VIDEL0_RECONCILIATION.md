# Videl0 → Multi-MusicBot reconciliation

Status: reference behavior mapping; selected foundational behaviors and emoji catalogue data are now independently implemented, as recorded in ARCHITECTURE.md. Not a live deployment report.

**Ordering update:** the latest [MASTER_ROADMAP.md](MASTER_ROADMAP.md) and [ARCHITECTURE.md](ARCHITECTURE.md) select Python/PyTgCalls first; isolated compatibility tests selected Kurigram and rejected Wzgram 3.1.7. Intermediate Node-first preferences are superseded. Feature mapping and evidence limitations below remain applicable.

## Evidence and limits

Reference repository: https://github.com/Beasgohan-code/Videl0

Inspection date: 2026-11-15. Main HEAD observed: `6430b1e5e60e0776a7ab519e05cb98c2ca1a2ebf`. Files were fetched from main during inspection; pin implementation review to this commit before extraction.

Reviewed source excerpts: `videl/core/queue.py`, `videl/utils/assistant.py`, `videl/app/music.py`, `videl/plugins/music_sessions.py`, `videl/plugins/music_approval.py`, `webapp/src/components/studio/screens/Music.tsx`, `requirements.txt`, and music entries in `docs/COMMAND_REFERENCE.md`. Repository tree verified relevant test filenames. No Videl0 tests were run. Existence of handlers/tests is not evidence of live Telegram correctness. The supplied inventory is an input, not independently verified in full; this document covers every music capability named in that inventory, not every repository command or alias.

Confirmed from inspected excerpts:
- Queue is keyed by chat in the original and persists recovery metadata to `music_queue_recovery`.
- Recovery initialization does not join calls; explicit restore appends saved upcoming items behind fresh playback and checks capacity.
- Assistant startup starts the voice engine after client connection; readiness and membership helpers exist.
- Queue manipulation includes rollback on unconfirmed playback.
- Temporary DJ state and request-review handlers exist.
- Browser favorites/history/playlists use localStorage; browser playback uses an HTML audio element.
- Requirements pin Kurigram and describe a PyTgCalls voice stack.

Repository metadata did not report a top-level license. User ownership may permit reuse, but do not assume all dependencies/vendor assets are covered. Establish permission and review file-level/vendor licenses before copying code. This plan transfers behavior specifications first.

## Adopted architecture direction

Retain **TypeScript for controller, worker supervision, moderation, authorization, and durable music command orchestration**. Use a **Python/Kurigram/PyTgCalls voice service** as the preferred feasibility candidate rather than making a new Node native voice bridge the default.

Only TypeScript consumes worker bot updates. Python uses operator-provisioned assistant user sessions and executes validated voice operations; it does not poll worker bot tokens or independently moderate chats. Translate Videl0-specific global clients/configuration into explicit per-session dependencies. Do not lift the entire single-bot runtime into each worker.

Initial Render deployment: one paid Docker worker with an explicit supervisor for Node and Python, private IPC (Unix socket or child-process framed messages), bounded restarts and separate health states. No public voice API. Prove Python native dependencies, IPC and actual calls on Render first. If split into services later, use authenticated private transport and verify hosting/network support; never expose unauthenticated playback endpoints.

Queue authority is TypeScript; Python owns observed stream state only. This intentionally adapts Videl0 queue behavior rather than duplicating queues across languages. A Python-owned authoritative queue is not selected; any future boundary change requires an explicit tested migration, not a second queue manager. Passing commands through two independent queue managers is prohibited.

## Common API and persistence contract

The operations below are logical internal operations, not public unauthenticated HTTP routes. All requests carry schema_version, request_id/idempotency_key, bot_id, chat_id, actor_id, correlation_id, expected_session_revision. The controller derives tenant identity and checks group/DJ permissions before dispatch. Voice operations also require a valid assistant lease generation and session_id. Never accept arbitrary paths, shell strings, media URLs or FFmpeg arguments from a browser.

- `PlaybackCommand`: enqueue/play-next/pause/resume/skip/stop/replay/seek/set-profile.
- `QueueCommand`: clear/remove/move/jump/shuffle/set-loop/restore.
- `LibraryCommand`: playlist CRUD, history/favorites queries.
- `VoiceEvent`: accepted, playback-started, paused, ended, failed, disconnected, heartbeat.

Accepted is not playback-started. Correlate acknowledgements and terminal events, deduplicate event_id, reject old session generations, time out uncertain starts, and reconcile observed state before retrying. Serialize queue mutations per bot+chat and use durable revisions. Promise at-least-once delivery with deduplication, not magical exactly-once external side effects.

Notation: **C** = behavior visible in inspected source excerpts; **H** = command/test inventory evidence or supplied report only, deeper source review required. No row is live-validated. Priority **P1** = core, **P2** = expanded, **P3** = later/optional.

## Feature mapping

All group-scoped collections include bot_id + chat_id; user libraries include bot_id + owner_id by default. Shared cross-clone access is explicit, never inferred from matching user IDs.

| Existing capability / evidence | New module; internal operation | MongoDB persistence | Required acceptance tests | Priority |
|---|---|---|---|---|
| Play (H), readiness (C) | music/playback + voice adapter; enqueue/start | music_sessions, music_queues, call_leases | membership denial, local-file start acknowledgement, unavailable assistant, tenant isolation | P1 |
| Force-next (H) | music/queue; enqueue(position=next) | music_queues | stable insertion order, capacity race, no interrupt unless explicitly force-play | P2 |
| Video play (H) | voice/video; start(media_kind=video) | music_sessions | audio/video support probe, CPU caps, unsupported profile rejection | P3 |
| Channel play (H) | music/destinations; bind-target | group_bindings, groups | linked-channel authority, target permissions, correct tenant, unsupported target error | P3 |
| Pause/resume (C handler inventory) | playback; pause/resume | music_sessions revision | duplicate commands, stale session, remote pause failure | P1 |
| Skip/stop (C handler inventory) | playback; skip/stop | music_sessions, music_queues | one advancement, late end event, stop cancels autoplay/jobs | P1 |
| Replay (C handler inventory) | playback; replay | music_sessions | fresh source resolution, correct revision, stale callback rejected | P2 |
| Queue display (C) | queue/read-model; get-queue | music_queues | safe escaping, bounded output, current/upcoming distinction | P1 |
| Shuffle/loop (C handler inventory) | queue/policy; shuffle/set-loop | music_queues, groups | track vs queue loop, shuffle excludes current, stop overrides loop | P2 |
| Move/remove/jump (C) | queue/editor; move/remove/jump | music_queues | out-of-range, revision race, rollback if jump unconfirmed | P2 |
| Clear upcoming/reset player (C handler inventory) | playback/recovery; clear/reset | music_queues, music_sessions | current continues on clear, reset invalidates old events, idempotency | P2 |
| Queue admission/caps (C) | queue/admission; reserve-capacity | music_queues, owners quotas | concurrent admissions, bounded playlist expansion, atomic cap | P1 |
| Snapshots/manual restore (C) | recovery; snapshot/list/restore | queue_snapshots | never auto-replay interrupted current, fresh playback required, all-or-nothing capacity, duplicate restore | P1 |
| Bass/speed/effects (H) | media/profiles; set-effects | groups audio profile | preset allowlist, no raw filter injection, effective duration/seek, child cleanup | P2 |
| Seek/seekback (H) | playback; seek absolute/relative | music_sessions | duration bounds, live/nonseekable errors, resume offset, superseded seek | P2 |
| Studio/high/medium/low (H) | voice/profiles; set-quality | groups quality profile | profile mapping, engine compatibility, resource ceiling; no unsupported fidelity claim | P2 |
| Save/load/list/delete playlists (H) | library/playlists; playlist CRUD/import | playlists | owner isolation, ordered capped items, deleted source, import atomicity | P2 |
| Autoplay (H) | discovery/autoplay; suggest/enqueue | groups, plays, bounded recommendation cache | stop cancellation, duplicates, no-result, rights/source failures, quota | P3 |
| Search picker (H) | media/search + callbacks; search/select | short-lived search_sessions | requester binding, forged index, expired picker, cache isolation | P2 |
| Lyrics (H) | media/lyrics; lyrics lookup | bounded lyrics_cache | provider failure, pagination/escaping, timed-line alignment | P2 |
| Song/video/download (H) | media/download-jobs; submit/status/cancel | download_jobs | allowed source, size/duration cap, expiry, no arbitrary file read, Telegram delivery limits | P3 |
| Temporary DJ handoff (C) | auth/music-roles; assign/end-DJ | dj_sessions | admin-only assignment, revocation/expiry, tenant scope, no moderation rights | P2 |
| Request approval (C handler exists) | music/requests; request/approve/reject | music_requests | authorized approver, double approval, queue now full, requester ban, expiry | P2 |
| Admin playback controls (H) | auth/policy; authorize | groups, djs | real group-admin check, anonymous admin handling, revoked rights | P1 |
| Vote skip (H) | music/votes; vote-skip | skip_votes with expiry | one vote per eligible user/session, threshold change, expired song votes | P2 |
| History (C handler inventory) | library/history; list-history | plays | confirmed starts vs attempted tracks, per-tenant privacy, retention | P2 |
| Assistant join/create VC (C membership helper; creation H) | voice/readiness; check/join/create-if-permitted | assistants, call_leases | no invite rights, join approval, startup ordering, call absent, explicit create policy | P1 join; P3 creation |
| Playback acknowledgement/rollback (C) | music/orchestrator; reconcile-start | music_commands, music_sessions | accepted-not-started, process crash, timeout, duplicate/late acknowledgement | P1 |
| Player cards/inline controls (C) | music/presenter; render/update | music_sessions message reference | callback authorization, stale cards, edit failure, flood wait | P1 |
| Web search/browser play/queue/seek/volume (C excerpts) | optional web/browser-player | browser-only state initially | never confuse browser pause/volume with VC control, authenticated API access | P3 |
| Browser favorites/history/playlists (C) | optional web/library-sync | favorites, playlists, plays | opt-in localStorage migration, dedup, conflict/version, owner scope | P3 |
| Web synced lyrics/download status/expanded mode (C excerpts; full behavior H) | optional web/player + jobs | download_jobs; lyrics cache | timestamp mapping, protected status lookup, accessible UI, cancellation | P3 |

Autoplay starts with bounded related-track suggestions, not an unvalidated custom recommendation engine. Cloud library access across clones requires explicit user opt-in, an ownership model, and transfer/revocation rules. Synchronizing a browser player with group voice playback is a separate product feature, not a side effect of persisting playlists.

## New platform systems, not supplied by a single-bot music engine

| System | Contract / records | Required proof |
|---|---|---|
| Worker registry/supervisor | bots desired/observed state, ownership leases later | per-bot restart; one polling consumer per token; failed token doesn't stop others |
| Encrypted vault | authenticated encryption, key version, secret references | tamper/rotation tests; redacted logs; no tenant reads of assistant sessions |
| Assistant allocator | assistants + call_leases with fencing generation | competing tenants cannot reserve one slot; old process cannot release new lease |
| Resource scheduler | per-owner bot/call/download limits, queue admission | bounded fair scheduling; no unbounded resource promise |
| Owner dashboard | actor-bound bot operations | object-level authorization on every action |
| Tenant analytics | bot-scoped aggregates/plays | privacy, retention, cross-tenant query tests |
| Subscription/billing | deferred; manual quotas first | verified provider webhooks/idempotency before paid entitlements |

## Recovery design

Persist bounded source metadata, not temporary file paths or expiring stream URLs. Snapshot format is versioned and tied to bot+chat. Restart marks old streams interrupted, reconciles leases/native processes, and offers saved upcoming tracks. It does not silently reconnect every old group. An authorized admin starts a fresh track then explicitly restores pending metadata. Resolve sources again and reapply current permissions/limits. Restore consumes a snapshot revision atomically; stale retries cannot append it twice. Group migration, removed bot access, and deleted tenants invalidate incompatible snapshots.

## Group-management reconciliation

Do not copy all 215 reported registered names into the new roadmap or treat that count as music features. Keep the scoped moderation plan in PLAN.md: setup rights diagnostics, greetings, rules/notes, warnings, sanctions, durable expiry, then opt-in anti-spam. Federation, appeals, publishing, backup, premium formatting, custom commands, and creative tools remain deferred unless selected. The main controller may use the same moderation modules in its own groups, but tenant registration/lifecycle remain private controller functions.

## Revised delivery sequence

1. **Architecture spike:** prove Python assistant start → PyTgCalls → local file → pause/resume → switch/leave on Render; prove Node↔Python acknowledgements, crash isolation, and secret redaction.
2. **Platform:** secure registration, worker supervisor, MongoDB repositories and tenant tests.
3. **Moderation:** minimum group management with restart-safe punishment expiry.
4. **Core music + recovery:** tenant queues, fenced assistant allocation, acknowledged playback, safe snapshots/manual restore, inline cards.
5. **Expanded music:** playlists/search, effects/quality/seek, DJ/request/votes; review each original implementation and its tests before port/adaptation.
6. **Optional web:** authenticated dashboard and explicit cloud library migration; group voice remote control uses the same authorization/command pipeline, never browser audio state.
7. **Hardening:** Render resource measurements, failure tests, backup/restore, deletion/retention and operator runbook.

## Current adoption boundaries

Hybrid TypeScript control/moderation and Python voice is adopted. Main and worker group management share modules; multi-bot ownership is plan-limited, not permanently restricted to one worker. Web/Mini App/lounge, billing, downloads and video/channel remain explicit later gates. Initial call capacity remains one until measured; onboarding is disabled pending safety acceptance. No Videl0 application implementation/assets were copied; requested catalogue IDs/fallback data and independent presentation live in packages/bot-ui. No cloud resources or credentials are provisioned by this document.
