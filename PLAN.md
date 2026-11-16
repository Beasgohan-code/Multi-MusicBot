# Multi-MusicBot — Multi-tenant platform plan

Status: approved direction with a partially implemented Phase 0 prototype; not production-ready. Current evidence and blockers are maintained in MASTER_ROADMAP.md and PHASE_0_ACCEPTANCE.md. No repeated approval is required for bounded reversible increments.

## Current planning baseline

Repository: **Beasgohan-code/Multi-MusicBot**. Offline-tested TypeScript/Python implementation exists. No deployed platform or verified live Telegram/Render playback exists.

1. [Master roadmap](docs/MASTER_ROADMAP.md): latest A–Q feature scope, staged release gates, data/infrastructure constraints and incomplete-input note.
2. [Architecture](docs/ARCHITECTURE.md): TypeScript/Telegraf controller, workers, moderation and queue authority; **Python/PyTgCalls voice first**; Kurigram selected after isolated Wzgram compatibility failure. Earlier Node-first preferences are superseded.
3. [Phase 0 acceptance](docs/PHASE_0_ACCEPTANCE.md): offline evidence plus local permitted-audio and actual Render acceptance; live gates unrun.
4. [Source comparison](docs/SOURCE_COMPARISON.md) and [Videl0 reconciliation](docs/VIDEL0_RECONCILIATION.md): evidence and adaptation requirements, not live validation.

Launch remains private and bounded: main+worker moderation, secure clone management, core music and explicit upcoming-track recovery; one initial assistant/call. Full dashboard/Mini App, lounge, billing, advanced plugins and distributed infrastructure are later release gates, not rejected product goals. No invisible expansion into Redis or object storage before needed.

## Feature and logic expansion

See [Product logic](docs/PRODUCT_LOGIC.md) for concrete algorithms, state machines, added features, suggested bounded defaults and concurrency/failure scenarios. This is a design specification, not application code. The original Phase 0 gate remains unchanged.

## 1. Product direction

One main controller manages multiple branded worker bots. Each worker provides Telegram group management and optional voice-chat music. Owners register bots, configure them, see status, and manage their groups through Telegram menus.

Confirmed: Node.js + TypeScript, MongoDB, Render preference, and a spare assistant user account available. Target: multiple bots per owner within persisted plan limits. Initial rollout is invite-only and measured-capacity-limited, with one simultaneous music call until tested; onboarding is currently disabled.

Reference reviewed: https://github.com/abhinai2244/Multi-FileStoreBot — README, worker_bot/engine.py, main_bot/plugins/create_bot.py. Useful ideas: Create Bot/My Bots menus, dynamic client registry, per-owner settings, lifecycle controls, quotas, and persisted worker registration. This is architectural inspiration, not a code port. No explicit license was found through the repository license endpoint or root listing; do not copy implementation/assets without establishing permission. File storage, monetized shorteners, and force-subscription are not included in this product unless separately requested.

## 2. Three distinct identities

| Identity | Responsibility |
|---|---|
| Main controller bot | Registration, owner dashboard, platform administration; optionally its own group features using the same modules |
| Worker bot | Independent BotFather identity, group moderation, music commands, branding |
| Assistant user account | Actually joins Telegram voice calls and transmits audio; separate from every Bot API identity |

**Registering a worker does not create a BotFather account.** The owner creates the bot with BotFather and connects its token. The platform starts and manages that existing identity; it does not create Telegram user accounts or automatically provision hosting per bot.

**One worker bot is not one music assistant.** A bot can moderate many groups without an assistant. Music capacity depends separately on tested assistant/native-engine limits. Start conservatively with one active call for the spare account; adding bots must not imply unlimited simultaneous music.

## 3. User experience

### Main bot menu

- Create / Connect Bot
- My Bots → status, start/stop/restart, token rotation, delete
- Bot Settings → branding, group-management modules, DJ settings
- My Groups → permissions checklist, assigned worker, music status
- Help / Setup / Privacy

### Registration flow

1. Private controller chat, allowlist check, quota check, consent and hosting disclosure.
2. Owner creates a bot in BotFather. Securely submit token, validate with getMe, reject controller token and duplicate bot IDs.
3. Token possession authorizes connecting that identity; it does not independently prove legal ownership. Warn that the bot must not be polling or using a webhook elsewhere. Never silently delete another service's webhook; require explicit migration confirmation.
4. Show bot username and requested configuration; confirm registration with a short-lived, owner-bound action.
5. Encrypt credential, save bot identity/owner record, request startup through supervisor.
6. Add bot to group, grant only required admin rights, and run /setup to validate permissions. Add assistant separately only if music is enabled.

For local testing, provision credentials via environment/CLI. For hosted self-service, the bot's private token-submission flow must delete the sensitive message best-effort, never echo it, and redact update/error logs. Telegram bot chats are not end-to-end encrypted; deletion is not a guarantee against prior exposure. Offer an authenticated HTTPS onboarding form later if required. Never send actual secrets in this development conversation.

### Worker dashboard

Overview · Groups · Moderation · Welcome · Music · DJs · Playlists · Stats · Branding · Stop/Restart · Rotate Token · Delete.

Inline actions are owner/admin checked on every click; callback data is not authorization. Dangerous actions require confirmation. Platform owner privileges and group-admin privileges remain distinct.

## 4. Group management

### First release

- Welcome/goodbye templates with safe placeholders and length limits.
- Rules and reusable notes: /rules, /setrules, /save, /get, /notes.
- /warn, /warnings, /unwarn with configurable threshold action.
- /mute, /unmute, /ban, /unban, /kick; timed punishments persisted in MongoDB.
- /pin, /unpin and bounded /purge, subject to Telegram permissions and deletion limits.
- Optional anti-link and anti-flood with configurable exemptions and graduated actions.
- Admin/DJ permissions, group activity audit log, per-chat module switches.

Checks: require a real group admin for setup and privileged moderation; verify the bot has the required right before acting. Do not act on protected users/creator/self. Anonymous administrators need a conservative explicit verification flow; sender_chat is not a verified individual admin. Refresh admin checks for destructive actions and handle rights being revoked.

Anti-spam needs visibility into ordinary messages: document BotFather privacy/admin requirements and show diagnostics. Keep rules conservative and disabled by default until configured. Do not promise perfect spam detection or arbitrary historical-message deletion.

### Later

Join-request approval/captcha with expiry, language packs, scheduled announcements, advanced filters. No destructive anti-raid automation until tested. Worker broadcasts only to users who interacted with that worker, with opt-out, preview, rate limiting, and cancellation; platform-wide broadcast remains operator-only and deferred.

## 5. Music

### Core

/play query-or-supported-URL, /pause, /resume, /skip, /stop, /leave, /queue, /now; inline controls; queue caps; idle leave; per-chat serialized transitions.

### Expanded

Text search, playlist import with caps, shuffle, loop, volume, seek, saved playlists, lyrics, named FFmpeg filter presets, DJ mode, playback statistics. Spotify support is metadata matching against permitted playable sources, not Spotify audio streaming. Source availability/matches are not guaranteed. Support only media users have permission to stream.

### Assistant broker

- Operator provisions the spare account locally; no phone/OTP/password collection from tenant owners.
- Broker grants a lease for each active call, binding assistant + tenant + group + worker.
- Atomic capacity checks, explicit busy response, stale-lease cleanup after runtime reconciliation, no silent call displacement.
- One active music controller per group. Prevent two hosted workers from competing in the same voice chat.
- New assistants are operator-provisioned later; never assume a fixed number of calls per account without testing.
- Sessions are never exposed to tenants. Assistants only join explicitly configured groups. Explain their visible identity and privacy implications.
- Music failure must not disable moderation. Voice/native crashes require supervised isolation.

## 6. Architecture and deployment

```text
Telegram
  ├── Main controller bot ── registration / owner panels
  ├── Worker A ── group moderation + music commands
  └── Worker B ...
              │
Render paid Docker background worker (initial single replica)
  ├── Controller + worker supervisor (Telegraf long polling)
  ├── Shared feature modules + tenant-aware authorization
  ├── Durable jobs, quotas, rate limiting, audit
  └── Supervised Python voice child (Kurigram + PyTgCalls)
              │                         │
        MongoDB Atlas            FFmpeg + Telegram calls
```

Logical worker bots initially share a Node process; they are not dedicated Render services. Each gets its own Telegraf instance and bounded work queues. Per-worker startup failures are contained, but a host/process failure affects all hosted bots; do not claim hard isolation. Private framed IPC and the Kurigram/PyTgCalls baseline exist and are offline-tested; actual call/host feasibility remains unverified.

Render is a candidate, not a proven voice host: verify native Linux binaries, outbound Telegram/WebRTC networking, CPU/memory, and reconnect behavior on the actual paid worker. If this fails, use a voice-capable VPS or separate voice host rather than weakening security or promising unsupported playback. No free-tier keepalive tricks. Pricing and capacity must be checked before purchase.

Use one polling consumer per token. Start bots in small bounded batches; desired state in DB, observed state in runtime. Persist lifecycle states: registered, starting, running, stopping, stopped, error, suspended, deleting. Track sanitized failure reasons, retry with backoff/jitter, and quarantine revoked tokens. Graceful shutdown stops accepting commands, ends voice/FFmpeg, stops polling, releases ownership, and closes DB.

Do not auto-hibernate workers serving moderation: stopped polling misses time-sensitive events and cannot wake itself from commands. V1 uses explicit stop/start and idle music disconnect only. On restart, do not execute stale destructive updates blindly; reconcile durable timed actions and update checkpoints. Later multi-replica support requires fenced ownership leases and explicit sharding so two consumers cannot manage one bot.

## 7. Data model — MongoDB Atlas

Use shared indexed collections with explicit tenant bot_id, not unbounded collection creation per bot. All IDs are consistent strings; dates are BSON dates.

| Collection | Key content / indexes |
|---|---|
| owners | Telegram user ID (unique), allowlist, quota, account state |
| bots | bot_id unique, owner_id, encrypted token + key version, desired state, branding; owner_id index |
| groups | bot_id + chat_id unique, modules, music config, setup state |
| group_bindings | chat_id unique for active music-controller binding |
| djs | bot_id + chat_id + user_id unique |
| warnings | bot_id + chat_id + user_id index, reason, issuer, timestamp |
| notes | bot_id + chat_id + name unique, safe content |
| playlists | bot_id + owner_id + name unique, bounded ordered metadata entries |
| plays | bot_id + chat_id + played_at index, bounded metadata |
| assistants | operator ID, encrypted session, enabled/health state; no tenant-readable secrets |
| call_leases | assistant_id unique in initial single-call model; chat_id unique; tenant binding, expiry, generation |
| jobs | job_id unique, bot_id, due_at/status index, attempts, idempotency key |
| audit_events | bot_id + created_at index, actor/action/target, redacted details |

Tenant repositories require bot_id for every operation; never accept client-supplied owner_id as authority. Cross-tenant authorization tests cover list/read/write/delete paths. MongoDB service credentials are not row-level isolation; the app enforces tenant boundaries.

Timed unmute/unban jobs use durable scheduling and idempotent claims, not TTL deletion as a timer. Recheck current punishment version before reversing it; do not undo a newer admin action. TTL is only for eventual retention cleanup. Define retention defaults before launch: suggested 30 days audit, 90 days detailed plays, aggregate stats retained; group settings and saved playlists until removal.

## 8. Security and resource limits

- AES-256-GCM encrypted bot tokens and assistant sessions; random nonces, key versioning, encryption master key only in Render secrets, never in DB/repo. Document rotation and encrypted backups.
- Operator panels show masked tokens only. Never implement a command that dumps raw tokens or sessions.
- Least-privilege Atlas user, TLS, restricted network access compatible with deployment, no credentials in render.yaml.
- Tenant owners manage their bots, not all group moderation unless they are also group admins. DJs control music, not bans. Platform operators suspend services; group actions require group authority.
- Start invite-only; support multiple bots per owner within plan limits and a measured platform bot cap, one active music call, capped queue/import length and track duration. Set actual deployment limits after load testing.
- Rate limits per user/chat/bot and shared outbound limits, retry_after handling, bounded broadcasts/jobs, CPU and download budgets.
- SSRF defense for media URLs: protocol/host allowlists where feasible, DNS/private-IP and redirect checks, restricted downloader egress, no user-controlled FFmpeg flags or shell interpolation.
- Run media children without elevated privileges; execution timeouts, memory/process limits where supported, temporary-file cleanup and disk cap.
- Deletion stops runtime first, revokes platform access, removes stored credential, then purges tenant data through a retryable job. Clearly distinguish disconnecting a bot from deleting its Telegram identity. Retain only disclosed minimal security records.
- Data transfer deferred; if added, require the same verified owner, preview/confirmation, and never transfer tokens or assistant secrets.

## 9. Earlier layout sketch (superseded by architecture specification)

```text
src/
  controller/          # onboarding, My Bots, owner/operator panels
  workers/             # registry, lifecycle state machine, polling supervisor
  modules/
    moderation/        # sanctions, warnings, anti-flood/link
    welcome/           # greetings, rules, notes
    music/             # commands, queue, playlists, filters
  auth/                # platform/tenant/group/DJ policy checks
  voice/               # assistant broker, IPC, native bridge child entrypoint
  media/               # safe resolver, downloader, FFmpeg
  db/                  # tenant-scoped repositories, indexes
  jobs/                # durable scheduling, retries
  security/            # encryption, redaction, URL policy
  config.ts
  index.ts
scripts/               # local session generation, operator provisioning
 tests/                # unit, tenant isolation, integration fixtures
Dockerfile
render.yaml
.env.example
```

Stack: Node.js 22+ (24 requires validation) + TypeScript ESM, Telegraf, official MongoDB driver, Python/Kurigram 2.2.26 + PyTgCalls 2.3.3 + ntgcalls 2.2.5, FFmpeg and redacted logging. Native versions are pinned in the isolated baseline lockfile. Provider extraction such as yt-dlp remains separately gated.

## 10. Delivery gates

| Phase | Deliverable | Acceptance gate |
|---|---|---|
| 0 — Feasibility/security foundation | TS scaffold, config, DB indexes, encrypted secret helper, local session script, Render voice smoke test | Local permitted file plays in real group on target host; pause/resume/source switch/leave; no leaked secrets. If voice gate fails, revisit hosting/backend; controller work can continue separately |
| 1 — Controller platform | Invite-only onboarding, one worker, My Bots, rotate token, stop/restart/delete, startup reconciliation | Register two test identities, restart host, restore desired workers; duplicate token rejected; no unauthorized dashboard actions or cross-tenant records |
| 2 — Group management | Setup diagnostics, welcome, rules/notes, warnings, sanctions, durable expiry jobs | Real test-group rights checks, restart-safe timed mute, denied non-admin actions, two-tenant isolation tests |
| 3 — Music core | Assistant broker, queues, player commands, inline controls, idle leave | Queue advances once; concurrent requests serialize; busy capacity handled; voice failure leaves moderation working |
| 4 — Expanded features | Search/playlists, DJ mode, lyrics, safe filters, stats, opt-in anti-spam | Caps enforced, callbacks authorized, permission/source errors actionable |
| 5 — Production hardening | Render blueprint, quotas, load test, backup/restore, operator guide, deletion/retention jobs | Measured capacity, crash/recovery tests, credential rotation test, tenant deletion test; operator approves deployment |

Automated tests: policy matrix, encryption/tamper detection, queue transitions, per-chat concurrency, lifecycle races, job idempotency, quota races, tenant isolation, redaction, media URL rejection. Mock Telegram for CI. Real moderation and voice tests require a dedicated Telegram test group and credentials configured outside chat.

## 11. Launch direction and remaining gates

1. **Main bot:** controller first; optionally enable moderation/music in its own groups via the same modules (no self-registration).
2. **Worker access:** invite-only initially, later open registration with abuse controls.
3. **Worker features:** moderation enabled after setup; music optional and capacity-limited.
4. **Assistant:** shared operator-managed spare account, one active call initially; expand only after tests.
5. **Product scope:** inspired by the reference's bot-management UX; no FileStore functionality unless explicitly added.

Continue Phase 0 safety implementation under the existing NEXT policy: inspect all repository Markdown and code, tests first, verify, update existing docs, review secrets/concurrency, commit and push the active branch. Current implementation includes fenced ownership, authenticated operator supervision, atomic receipts and bounded operator relay; these do not authorize onboarding. No cloud resources have been provisioned.
