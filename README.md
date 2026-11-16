# MultiMusicBot

### One control bot. Independent clone bots. A shared, secure music platform.

MultiMusicBot is a Telegram-first bot-hosting platform in development. The goal is to let an owner connect a BotFather-created bot, configure its identity and modules, and operate an isolated music and group-management bot without deploying a separate codebase.

**Status: Phase 0 engineering prototype. Not production-ready.** Local queue, lease, child-process and UI tests exist. Real Telegram audio playback, crash reconciliation and Render feasibility have not passed live acceptance. This repository does not yet offer a working `/clone` flow or a deployed dashboard.

## What “cloning a bot” means

A clone is a separately registered Telegram bot using this platform's shared runtime—not a copied Telegram account, copied session or automatically created BotFather bot.

The intended onboarding flow is:

1. Create a bot through **@BotFather** and register it through an authenticated, private platform flow.
2. Validate the token and ownership; reject duplicate registrations and enforce owner limits.
3. Encrypt the token at rest and provision a tenant-scoped configuration and worker grant.
4. Choose a profile/template, enabled modules, permissions and queue limits.
5. Start an independent worker; show readiness, permissions and assistant availability before accepting playback.
6. Manage the clone through Telegram: settings, diagnostics, stop, restart and deletion.

**This flow is a target, not implemented onboarding.** Never paste bot tokens, encryption keys or assistant sessions into issues, logs or this chat. Bot tokens must never appear in callback data, URLs, audit events or screenshots.

## Implementation boundary

| Area | Present in this checkout | Still required |
|---|---|---|
| Control plane | Configuration and encrypted-secret repository foundations | Telegraf registration, owner authentication, menus and controller wiring |
| Clone runtime | Grant-authenticated registry and operator supervisor; playback entrypoint | Complete lifecycle supervisor, readiness, crash reconciliation and restart policy |
| Playback | One-track Python children; correlated events; persisted queue controls; guarded leases and renewal | Real Telegram validation and complete failure acceptance |
| Recovery | Upcoming-track metadata preservation; uncertain-cleanup quarantine | Trusted native cleanup/release reconciliation and real persistence/crash acceptance |
| Audit | Safe playback-event sink; atomic ownership outbox/relay and terminal queue receipts/operator relay | Real Mongo verification, complete runner audit relay and full transition coverage |
| Telegram UI | Videl0 emoji catalogue, safe renderers, shared message templates | Wiring into future Telegram handlers and eligibility verification |
| Web, billing, plugins, lounge | Product scope in existing docs | Deferred; no functioning dashboard or subscription service |

See [Phase 0 acceptance](docs/PHASE_0_ACCEPTANCE.md), [master roadmap](docs/MASTER_ROADMAP.md) and [architecture](docs/ARCHITECTURE.md) for evidence and release gates. No Phase 1 readiness is implied.

## Architecture

The expanded [architecture audit and target mapping](docs/ARCHITECTURE.md#10-current-repository-audit-and-target-mapping-2026-11-15) maps existing files to the clone platform, specifies all settings application boundaries and lists required Mongo models, indexes and migrations. No voice files were relocated to match a proposed tree.

```text
Telegram users / group administrators
                 │
                 ▼
TypeScript + Telegraf control plane             [planned integration]
  owner authentication · clone registration · settings · lifecycle
                 │
                 ▼
Independent TypeScript bot workers             [partial]
  tenant-scoped commands · authoritative queue · lease fencing
                 │ private framed IPC
                 ▼
Python + PyTgCalls voice child                  [implemented, offline tested]
  one track per child · native events · bounded cleanup
                 │
                 ▼
Telegram group voice chat                      [live validation pending]

MongoDB: encrypted credentials · queues · assistant leases · workers · audit
Shared bot-ui: semantic icons · HTML escaping · Unicode fallback · templates
```

### Non-negotiable isolation rules

- Derive tenant ownership from trusted registration, not incoming callback fields.
- Scope repositories and queue mutations to the bot and chat; use revision-based CAS.
- Acquire an assistant lease before starting playback. Fence messages by session, generation and request identity.
- Never start the next voice child before the previous child is reaped.
- Release an assistant only after confirmed native cleanup; uncertain cleanup quarantines ownership.
- Preserve upcoming metadata on recovery without blindly replaying an interrupted start.
- Restrict local media to an operator-provisioned allowlist. No arbitrary tenant paths or URLs.

Some rules have local tests; global crash safety still requires the remaining acceptance work.

## Repository layout

The current layout stays buildable. Empty placeholder services are not treated as completed features.

```text
Multi-MusicBot/
├── apps/
│   ├── bot-runtime/          # Playback runner, Python transport and execution config
│   └── voice-engine/        # Python native adapter, IPC, deadline and session helpers
├── packages/
│   ├── bot-ui/              # Shared Telegram presentation API
│   │   ├── custom-emojis/   # Generated Videl0 IDs, aliases and Unicode fallbacks
│   │   └── index.ts         # Surface-aware icons, buttons and message templates
│   ├── config/              # Validated environment configuration
│   ├── database/            # Scoped secrets, queue, lease and worker repositories
│   ├── observability/       # Structured safe audit sink
│   ├── queue/               # Authoritative queue transitions
│   ├── security/            # Authenticated credential encryption
│   └── shared/              # Strict cross-process contracts
├── scripts/                 # Operator playback and compatibility/session tools
├── tests/
│   ├── unit/                # TypeScript behavior and transport tests
│   ├── integration/         # Opt-in real Mongo tests
│   └── voice/               # Python runtime and native-adapter tests
├── docs/                    # Existing architecture, scope and acceptance evidence
├── .env.example
├── package.json
└── tsconfig.json
```

### Target module boundaries

As features earn their release gates, grow toward these boundaries rather than creating one service per folder:

| Location | Responsibility |
|---|---|
| `apps/control-plane/src/telegram` | Commands, callbacks, conversations and authorization middleware |
| `apps/control-plane/src/modules` | Authentication, tenants, bot factory, clone manager, profiles, settings, groups and permissions |
| `apps/bot-runtime/src` | Manager, registry, supervisor, lifecycle, isolation, health and recovery |
| `apps/voice-engine/src` | Engine, playback, media/providers, native adapters, assistants and private IPC |
| `packages/contracts` | Versioned IPC, API and event schemas |
| `packages/domain` | Pure bot, clone, music, group and permission rules |
| `packages/bot-ui` | Messages, keyboards, cards, menus, pagination, localization and fallbacks |
| `packages/database` | Models, tenant-scoped repositories, indexes and migrations |
| `packages/bot-templates`, `plugin-sdk` | Validated clone presets and permission-scoped extensions |
| `apps/web`, `apps/realtime-server` | Later dashboard/Mini App and optional synchronized listening |
| `plugins`, `infra` | Later optional features and verified deployment/monitoring assets |

Subscriptions, billing, analytics-pro, video and lounge remain later scope. A future directory move must update imports and tests; this README does not imply those directories or features already exist.

## Videl0 custom emoji system

The full production catalogue from [Videl0](https://github.com/Beasgohan-code/Videl0/blob/6430b1e5e60e0776a7ab519e05cb98c2ca1a2ebf/videl/utils/premium_emojis.py) is extracted as data: **664 aliases, 611 unique IDs**, pinned to commit `6430b1e5e60e0776a7ab519e05cb98c2ca1a2ebf`. Original aliases, pack aliases and supplied Unicode fallbacks are preserved. The extraction does not import or execute upstream Python code, copy its application implementation or download emoji artwork. IDs are strings to avoid JavaScript precision loss. Test-only example IDs are not production icons.

```ts
import {uiMessage, button, emoji} from './packages/bot-ui/index.js';

// Enable only after verifying this sending bot's Telegram eligibility.
const capabilities = {customEmoji: true};
const welcome = uiMessage('welcome', 'Manage your bots from one place.', capabilities);
// Future Telegraf handler: ctx.reply(welcome.text, {parse_mode: welcome.parse_mode})
const play = button('music', 'Play', 'play', capabilities);
const callbackToast = emoji('check', capabilities, 'plain');
```

All current shared templates—welcome, fleet, settings, now-playing, queue and error—use this layer. **No running Telegram UI exists yet to migrate.** New bot-facing UI should use semantic catalogue aliases instead of embedding numeric IDs in handlers.

- HTML messages/captions can use `<tg-emoji>` when the sending bot is eligible.
- Default rendering is Unicode until that capability is verified; a user's Premium subscription alone is not proof of bot eligibility.
- Button labels and callback toasts always use Unicode, not HTML tags. Native custom button icon support is not implemented here.
- Dynamic tenant text is HTML-escaped. Technical IPC, database errors and audit records remain undecorated.
- Telegram rendering and availability of every upstream ID remain unverified live.

To regenerate from a checkout of the **pinned** upstream revision:

```bash
python3 scripts/extract-videl-emojis.py /path/to/Videl0
```

## Local development

Requirements: Node.js 22+, npm, Python 3.10+ (tested here with 3.11). Native playback additionally requires FFmpeg, compatible native libraries, a permitted Telegram assistant account, a test group with an existing voice chat and network access.

```bash
npm ci
npm run check

# Optional: test real Mongo repositories against a disposable test target.
# The suite creates and drops a random music_test_* database.
TEST_MONGODB_URI='mongodb://...' npm run test:integration
```

Configuration keys are in [.env.example](.env.example). Scripts do **not** automatically load dotenv files. Provision values through a local shell or deployment secret store. Keep Mongo private and provision the encryption key separately from stored ciphertext.

### Python compatibility

Use an isolated Kurigram environment for the current PyTgCalls baseline; do not install both namespace providers together. The evaluated Wzgram version failed the PyTgCalls import compatibility probe, so it is not the selected voice client.

```bash
python3 -m venv .venv-kurigram
.venv-kurigram/bin/pip install -r apps/voice-engine/requirements-kurigram.lock.txt
.venv-kurigram/bin/python -m unittest discover -s tests/voice -v
```

Dependency construction tests do not establish audible playback. See the existing acceptance document for session-generation and compatibility commands.

### Operator-only playback prototype

With a provisioned enabled assistant record, Mongo service, trusted media fixtures and local credentials:

```bash
npm run phase0 -- --enqueue fixture-a --enqueue fixture-b
```

Required execution bindings include `WORKER_GRANT`, `VOICE_BOT_ID`, `VOICE_CHAT_ID`, `VOICE_ASSISTANT_ID`, `VOICE_MEDIA_ROOT`, `VOICE_MEDIA_HANDLES`, Mongo settings and assistant credentials. See `apps/bot-runtime/execution-config.ts`. The runner assigns child session/generation/deadline values. It does not create accounts, authorize a user interactively or create a group call.

`--recover` preserves upcoming metadata; it does **not** clear assistant quarantine or prove native cleanup. This entrypoint now authenticates a provisioned worker grant, claims the fixed bot slot, heartbeats ownership and drains the runner before reporting shutdown. Provision matching `bots`, `worker_grants` (SHA-256 token hash only) and a stopped `workers` slot with generation 0 through a trusted operator. No public provisioning endpoint exists. Heartbeat loss aborts work promptly; the supervisor waits for runtime drain and the exact outstanding heartbeat/relay promise before persisting conservative quarantine. A timeout is not cancellation, and a late heartbeat cannot restore readiness. Finish persistence is also awaited without retry. A never-settling operation deliberately holds execution pending rather than falsely finishing the holder; bounded host escalation remains unfinished. No automatic restart or expiry takeover is enabled. It is still not an approved concurrent clone fleet.

### Ownership maintenance (trusted operators only)

`npm run phase0:maintain` uses only `MONGODB_URI`, `MONGODB_DB` and `VOICE_BOT_ID`. Database credentials authorize this restricted local tool; it is not a tenant API. It archives/acknowledges at most 100 pending terminal receipts for that bot, drains pending ownership audit events, scans at most 100 expired workers and 100 expired assistants, quarantines matching holders and drains ownership events again. Run further batches if needed. Output contains counts, never credentials or raw database errors.

The tool **does not confirm cleanup, free an assistant or restart a worker**. Expiry is not proof that a remote native process is gone. Malformed events and failed archive writes remain pending. Ownership mutations stop when 100 pending events fill a document, rather than losing audit history. During operator playback the supervisor also relays ownership events on heartbeat and finish. Terminal archives use tenant+chat+receipt-revision identity; acknowledgement increments queue revision so a stale queue replacement cannot resurrect receipts. Concurrent queue changes may return a conflict: rerun a bounded batch from a fresh read, never replay playback. Prefer maintenance while playback is drained to avoid interrupting an active CAS. There is no independently deployed background maintenance scheduler yet. Pending journals still fail closed at 100 if maintenance is not run; never clear them manually.

## Deployment and release gates

Render is the preferred worker-hosting candidate, pending controlled measurements of CPU, memory, startup, playback and cleanup. Python voice requires a long-running process host; a serverless web deployment is not a replacement. No ready-to-deploy Render claim is made.

Before a private alpha: finish abandoned-lease reconciliation, cancellation/late-settlement handling, atomic transition auditing, authenticated controller lifecycle and restart policies; pass real Mongo failure scenarios, actual Telegram queue/recovery/session-release tests and controlled Render resource tests.

## Security and references

Report security issues privately to the repository maintainer; do not include raw credentials. Videl0 is the emoji-data reference, not a claim of inherited functionality or a blanket license grant for its code or artwork. Review upstream and emoji-pack permissions before redistribution of artwork. No application code or assets from that repository were vendored for this UI layer.
