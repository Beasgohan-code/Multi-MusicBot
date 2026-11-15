# Reference comparison and integration decisions

Inspection: 2026-11-15. Planning only; no packages installed, upstream tests run, or live Telegram/provider calls performed. Evidence is GitHub metadata, manifests, README excerpts and the specific source files noted below. README claims are not independently verified platform capabilities.

## Identified sources

| Reference | Observed revision / release | Evidence and license |
|---|---|---|
| [ShizuMusic](https://github.com/Badmunda05/Shizumusic) | default branch Bad; HEAD observed 83def61f73de7efd8c19cf451cf2937886c74652; latest release returned V2.6 | README, requirements.txt, recursive source tree; GitHub reports MIT |
| [Richgram](https://github.com/Badmunda05/Richgram) | main HEAD observed c114893937bcb155bc3645a969b4c4012de6f7fd | README, pyproject.toml, nextgram module tree; GitHub/manifest report MIT |
| [TypeTube](https://github.com/Playeon/Typetube) | main HEAD observed b970886f351d92277371edcc4aff94744981001e; package.json 1.1.4 | README, package.json, src/index.ts, source tree; MIT |
| [Wzgram](https://github.com/rjriajul/wzgram) | default dev HEAD f256c1dafe12bf3d80918772c49315d3eeb3cfc5; latest release returned v3.1.7, 2026-11-11 | README, pyproject.toml, release notes; manifest LGPL-3.0-or-later |
| [Videl0](https://github.com/Beasgohan-code/Videl0) | See VIDEL0_RECONCILIATION.md | Queue/assistant behavior reference; reuse permission unresolved |
| [Multi-FileStoreBot](https://github.com/abhinai2244/Multi-FileStoreBot) | Earlier inspection, not pinned | Controller/worker lifecycle inspiration; reuse permission unresolved |

Playeon also has a separately inspected lounge repository; see the pinned review below. Badmunda05 is an author; ShizuMusic and Richgram are two distinct supplied projects.

## Findings and decisions

| Area | Source finding | Decision | Integration gate |
|---|---|---|---|
| Voice/music UX | ShizuMusic README describes player controls, effects, playlists, channel play, languages and thumbnail toggle; tree contains corresponding modules | ADAPT behavior and language/template ideas; do not import its entire single-bot runtime | Inspect implementation and tests for each adopted feature; namespace by bot+chat, preserve tenant permissions |
| Python voice baseline | ShizuMusic requirements pin py-tgcalls==2.3.3 and constrain ntgcalls, while Telegram dependency is kurigram (despite Pyrogram README wording) | Use as compatibility research, not a lockfile to copy | Fresh dependency resolution, native build and actual Render playback; review unpinned/transitive dependencies |
| Rich messages | Supplied Richgram repo currently declares package/import nextgram; ShizuMusic asks for richgram==0.2.0 | ADAPT presentation patterns; do not assume current repo is the installed historical package | Verify exact package/version/provenance and protocol support; preserve MIT notices if copying |
| Telegraf presentation | nextgram is Python and advertises adapters for Python frameworks, not Telegraf | Build a TypeScript presentation interface with standard HTML/text and inline controls first | No bot-token transfer to Python just to render a message; optional direct Bot API extension only after documented capability validation |
| Custom/premium emojis and widgets | Current README claims advanced rich/widget support and fallback; not live-tested | DEFER advanced transport; use graceful plain-text fallback | Verify Telegram API methods, supported accounts/clients and eligibility; test unsupported-client and rejection behavior |
| Search/resolve | TypeTube src/index.ts implements search, resolve, playback metadata and stream selection | OPTIONAL provider adapter, not queue or Telegram transport | Contract tests, timeout/rate/error handling, live provider evaluation with consent |
| Provider trust | TypeTube default target is sg.clusters.typetube.xyz, uses TapClient, configurable server/auth/encryption options | Explicit external-service dependency; disabled until reviewed/configured | Verify provider identity, encryption/server verification defaults, terms, privacy, quotas/pricing and deployment egress. Do not claim fully local/offline extraction |
| Stream expiry | TypeTube checks URL expire metadata and can re-resolve tracks | ADAPT freshness principle; treat provider URLs as untrusted ephemeral results | Validate destinations/redirects before fetch, re-resolve safely, never snapshot signed URLs as durable source identity |
| MTProto client | Wzgram README describes Python Pyrogram replacement; manifest packages both pyrogram and wzgram namespaces and depends on WarpCrypto | Candidate for the Python voice service, not a replacement for TypeScript Telegraf | Verify PyTgCalls client detection, imports, session generation, reconnect and real call operations |
| Namespace conflict | Wzgram and Kurigram both supply Pyrogram-compatible imports | REJECT installing both into the same voice environment | Separate candidate environments; choose and pin one distribution per production image |
| Advanced Telegram features | Wzgram README/release notes list expanded Telegram support and layer changes | DEFER features unrelated to first release | Feature-by-feature permission/capability tests; do not infer that an MTProto feature exists in Bot API |
| Licensing | MIT projects and LGPL Wzgram have different distribution obligations | ADOPT only after dependency/notice review | Preserve notices, review modifications and container redistribution compliance; this is not legal advice |
| Recovery/DJ/queues | Videl0 has inspected queue recovery, acknowledgement rollback and DJ/request concepts | ADAPT as specified in VIDEL0_RECONCILIATION.md | Single queue authority, tenant isolation, explicit restore and stale-event tests |
| Clone control | FileStore reference uses dynamic clients and owner menus | ADAPT UX/lifecycle, not raw-secret inspection or sleeping moderation bots | Encrypted secrets, one poller/token, quotas, explicit start/stop and deletion |

## Architecture direction

Based on the latest Python-first proposal: TypeScript controller, worker runtimes, moderation and authoritative queues; Python/PyTgCalls voice adapter. Evaluate Wzgram as an isolated MTProto compatibility candidate against a Kurigram baseline; do not promise Wzgram support until measured. Rich presentation remains on the bot-command side, independent of Python voice. TypeTube is an optional Node media-provider adapter behind our own validated Track/Stream contracts. Redis, billing, a web dashboard and advanced widgets are not initial dependencies.

The latest MASTER_ROADMAP.md and ARCHITECTURE.md now adopt Python-first from the subsequent user blueprint; older Node-first notes are superseded. Regardless of selection, use the same PHASE_0_ACCEPTANCE.md gate.

## Additional acceptance requirements

1. Wzgram candidate: compatible session creation locally; assistant startup ordering; PyTgCalls binding; pause/resume/switch/leave; flood waits; reconnect; no namespace collision. Use a pinned tested version, not pip install -U in production.
2. Presentation: escape all untrusted text, enforce Telegram size limits, test standard HTML/text fallback and stale/unauthorized callbacks; advanced support must not bypass auth.
3. TypeTube: mocked search/resolve fixtures, malformed/oversized results, timeouts, provider outage, expired streams, private-IP/redirect rejection, bounded downloads, no provider credentials in logs.
4. ShizuMusic adaptation: effects presets bounded, channel/admin authority distinct, localization fallback, and no global dictionaries/settings leaking across tenants.
5. Record exact source revisions, installed artifacts and licenses in an adoption report before extraction. No deployment claim based on a README badge, marketing performance claim or release label.

## Scope and next steps

Retain main+worker group management and multi-tenant platform roadmap from PLAN.md. Prioritize verified local-file voice playback, secure controller/worker lifecycle, moderation and core music/recovery. Add source discovery, localization, richer cards and effects after core gates. Channel/video, external downloads, advanced widgets, shared libraries, billing and browser/voice synchronized controls remain separately gated.

Python-first is adopted; isolated compatibility testing selected Kurigram over incompatible Wzgram. Live Phase 0 acceptance remains pending.

## Playeon lounge inspection — 2026-11-15

Inspected [playeon/playeon](https://github.com/playeon/playeon) at `6ec6097bc7f5db19583618c226a5e4c410b90cee`: LICENSE, README, package manifests, RoomManager/server/roomToken, Telegram auth/join-room/access, room-store/media-engine and queue/progress handlers. No upstream execution or performance verification. This supersedes the earlier statement that no separate Playeon player was inspected.

License is **Attribution and Personal Use License v1.0**, not MIT: personal/noncommercial use, attribution obligations and express written permission for commercial use. Do not port implementation, assets or branding into this hosting product without permission. Generic ideas below require independent implementation.

Observed architecture: TypeScript/mtcute bot with embedded HTTP/WebSocket room server, Next/React/Three browser client, Mongo/Redis and yt-dlp/FFmpeg. RoomManager maintains process-local rooms keyed by group, server timestamps/paused positions and snapshot revisions; browser reconnects with bounded exponential backoff and rejects older revisions. This is a browser lounge, not evidence of our required durable bot+chat queue authority or fenced Python assistant lifecycle.

Adopt later: lightweight 2D lounge first with optional 3D; revisioned server timelines; authenticated preview/join; separate listen/control permissions; real autoplay/buffering/error states; audio-master synchronization with measured drift correction; refetch current queue before paginated actions. Every room/callback must bind bot+chat, actor and current authorization. Retain our Python voice boundary and durable queue authority.

Do not adopt development auth bypasses, query-string bearer tokens, cached privileges during authorization outages, group-only room identity, or random simulated progress percentages. Use fresh fail-closed authorization, short-lived tenant-bound/revocable credentials with secret-safe transport and actual correlated processing stages. README sub-50ms synchronization is unverified: inspected clock offset is a simple server timestamp difference, while master correction thresholds are around 1–1.2 seconds. Define and measure an RTT-aware drift budget before making synchronization claims.

Gate: lounge/auth/realtime implementation follows ownership settlement, durable recovery and real Phase 0 acceptance. No new runtime dependency or third-party implementation was copied in this review.
