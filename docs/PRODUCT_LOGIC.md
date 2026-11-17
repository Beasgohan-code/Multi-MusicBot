# Product logic and operational feature specification

Status: target product specification; foundational queue/ownership behavior is partially implemented and offline-tested. Feature rows are not claims of working handlers. Extends MASTER_ROADMAP.md without changing the TypeScript control plane / Python voice boundary or expanding Phase 0. Suggested limits below are configurable launch defaults, not measured capacity promises.

## 1. New features worth building

| Feature | Purpose and logic | Permission/data | Failure behavior and acceptance | Gate |
|---|---|---|---|---|
| Guided group doctor | Diagnose membership, bot rights, message visibility, assistant/call readiness and capacity; show checked-at and actionable fixes | /doctor for group admins; sanitized group diagnostics, short-lived cache | Unknown is not healthy. Rate-limit probes; test revoked rights and assistant unavailable. Only explicit setup actions may change settings | G1 |
| Capability-aware menus | Show supported operations for source, engine, role, group rights and entitlement | Backend capability projection; enforce action policy again at execution | Stale menu cannot bypass permissions; seek disabled for live sources; text controls remain usable | G1 |
| Scoped maintenance controls | Disable new registrations, new downloads or new music starts independently, without disabling moderation | Platform operator; versioned maintenance flags and audit | Existing playback drains by explicit policy; emergency stop is a separate confirmed action. Test ongoing moderation during music maintenance | G1 |
| Quiet-hours and notification budget | Reduce greetings/player edits and nonessential alerts; allow essential error/security notices | Group admin; timezone, quiet window, message budget | Never silently suppress a moderation action itself. Document which notifications are suppressed; DST/boundary tests | G2 |
| Fair request mode | Round-robin among requesters, bounded pending requests per person; explicit DJ override | Admin config; per-item requester, lane, sequence, enqueue time | No silent reshuffle of an already-announced next item; starvation and newcomer tests | G2 |
| Collaborative track suggestions | Members suggest; authorized DJs approve, members may withdraw their own pending item | Request records with revision, expiry, source identity, requester | Approval rechecks source, membership, queue/quota capacity; duplicate approval inserts at most once | G2 |
| Playback outcome explanation | Distinguish searching, queued, preparing, playing, blocked and failed; return a short support reference | Requester/group-safe view of command state; correlation ID | Do not leak stack traces, provider keys or signed URLs. Test uncertain playback-start acknowledgement and expired request | G1 state; G2 UI |
| Provider outage mode | Circuit breaker per provider/region as available; fallback only to configured permitted sources | Operator provider config; bounded health/circuit state | Do not silently substitute a different song. Require explicit confirmation for uncertain matches; test outage and half-open behavior | G2 |
| Moderation preview mode | Evaluate anti-link/flood rules without enforcing, then show aggregate would-act results | Group admin; ruleset version, bounded redacted counters | No automatic punishment while previewing; no full-message archive by default. Test exemptions and deletion of preview data | G2 |
| Case-based moderation | Each warning/sanction has case ID, reason, issuer, expiry, reversal reference | Group-admin policies; tenant+chat-scoped cases and jobs | Telegram execution state separate from intended action. An appeal creates review work, not automatic reversal; stale expiry cannot undo newer sanction | G1 cases; G4 appeals |
| Config diff and safe rollout | Preview changed settings, validate dependencies, apply with expected version, keep last known good config | Owner/manager for bot settings; group admin for group settings | Reject stale writes and unsafe combinations. Rollback creates a new version; never restores secrets or overwrites live queue state | G2 |
| Incident bundle | Generate scoped redacted diagnostics: versions, health, recent error codes, resource estimates and trace IDs | Owner sees only their bot; operator sees platform health; export expiry | Exclude tokens, sessions, raw updates, private content and source URLs with credentials. Snapshot unavailable metrics as unknown | G2 |
| Personal privacy controls | Pause history recording, erase personal history, revoke playlist sharing links, export owned library | Verified user in correct tenant; privacy prefs and deletion jobs | Erasure excludes explicitly disclosed legally/security-required records; explain aggregates/backup retention; do not promise immediate erasure from all backups | G2 basics; G3 web |
| Event sessions | Admin schedules a bounded playlist window with a preview, cancellation and end policy | Group admin; timezone, dueAt UTC, playlist revision and capacity budget | No unlimited assistant reservation. On due time recheck permissions/capacity; if too late, mark missed and notify, never surprise-play hours later | G4 |
| Safe bot replacement | Migrate non-secret config/library to a newly connected bot under same owner with preview | Verified owner, source/target revisions and migration job | Do not migrate Telegram identity, messages, grants or assistant sessions. Revalidate group membership/rights and require fresh setup | G4 |

No anonymous platform-wide reputation score, covert listening tracker, arbitrary executable plugin, or automatic punitive AI is proposed. A future natural-language helper may draft structured requests; backend authorization and explicit confirmation govern execution.

## 2. Universal decision order

Every command, callback, API request and scheduled job passes the same policy pipeline:

1. Validate transport identity and schema; cap payload size; reject replay/stale callback where applicable.
2. Derive bot/tenant from trusted runtime/auth context, never from submitted ownerId.
3. Check platform and tenant suspension/maintenance state and distinguish operations still allowed (help/export/stop vs new playback).
4. Resolve actor authority for this resource. Tenant ownership is not group-admin status. Scheduled jobs run under a scoped service capability created by an authorized actor and revalidate its ongoing authority.
5. Check enabled module, required engine/source capability, group binding/rights, current entitlement and rate limits.
6. Admit bounded work atomically: quota reservation, expected revision, idempotency key, request deadline.
7. Record durable intent, execute external work, record observed outcome. Accepted is not success.
8. Emit a sanitized result/audit event; release or settle reservation. Background retries must pass current suspension/lease checks.

Fail closed for unknown authority, invalid tenant, secret access or destructive moderation. Optional thumbnail/lyrics failure may degrade safely; authorization, quota and secret checks never degrade open. Define stable error codes: UNAUTHORIZED, STALE_REVISION, CAPACITY_BUSY, RATE_LIMITED, SOURCE_UNAVAILABLE, RIGHTS_MISSING, SESSION_INTERRUPTED, UNKNOWN_OUTCOME, FEATURE_UNAVAILABLE.

## 3. Concrete playback algorithm

### Request admission

1. Authorize play/request policy and apply cooldown. Save a bounded request ID; return a truthful preparing/searching acknowledgement.
2. Resolve through the configured media adapter under a deadline; validate normalized duration, identity and media destinations. Resolver results remain untrusted. Unknown duration is rejected by default unless a configured live-stream policy exists.
3. Under the group serialization boundary, recheck actor/request policy, active duplicate constraint, queue revision and capacity. Approval-pending requests are not playable queue entries.
4. Commit queue metadata plus command/outbox intent atomically as one bounded document or a supported DB transaction. The initial implementation must choose and test one strategy; two unrelated inserts are not atomic.
5. If no active stream, attempt assistant capacity reservation. A queued track does not promise immediate capacity; show queued/waiting or reject according to explicit group policy.

### Start and progression

- Queue item lifecycle: requested → resolving → awaiting_approval/queued → preparing → playing → completed/skipped/failed/cancelled. Only a current playing item may be paused; these are domain states, not all one MongoDB document enum.
- Acquire assistant slot with a fencing generation; get/join the permitted call; prepare a trusted local media handle. Keep initial prefetch at one next item and enforce byte/time/disk caps.
- Dispatch start with session ID, generation, item ID and revision. Engine accepted means waiting, playback_started means confirmed; a human audibility check remains part of live acceptance.
- A timeout yields UNKNOWN_OUTCOME. Query observed session state before retry; invalidate conflicting generations. Never interpret a lost acknowledgement as proof nothing started.
- Terminal event is deduplicated and compared to active item/session/generation. Commit completion and choose next item once. An old end event cannot end a new track.
- Loop track retries the same identity only on normal completion, not on source failure. Loop queue moves successfully completed tracks to its tail; failed tracks do not create infinite error loops.
- After three consecutive preparation failures (suggested default), pause progression, release resources safely, mark degraded and ask an authorized admin to retry/clear. Do not churn through a whole playlist indefinitely.
- /clear removes upcoming tracks and disables autoplay; current continues. /stop clears pending work, disables loop/autoplay, stops playback and leaves. /end and /leave alias /stop initially. /pause does not free a call indefinitely: configure an explicit pause timeout and warn before idle leave.

### Fairness rules

Default is FIFO. Optional fair mode preserves order within each requester's lane and alternates lanes; stable requester identity prevents repeated joins resetting fairness. Withdrawn items consume no future turn. Priority/DJ force-play is privileged, audited and explicit about interruption. Suggested default: at most one consecutive priority insertion while ordinary requests wait; an admin may override visibly. Never promise exact wait times when duration/live sources/provider prep are uncertain.

Vote skip is scoped to current session+item. One vote per eligible verified group member; eligibility means a configured member policy, not proof of listening. Snapshot threshold from configured eligible electorate where available; otherwise use an explicit fixed count. Do not present a misleading percentage of all listeners when attendance cannot be measured reliably. Admin skip remains a separately authorized action.

## 4. Assistant and recovery invariants

- One active lease per initial assistant slot; group binding prevents competing hosted workers in one call.
- Lease renewal compares holder and generation. Losing renewals stops new commands and fences/stops the stream after a bounded grace period. A new owner must reconcile/disconnect the old stream before starting; database expiry does not magically kill native calls.
- Bounded availability wait uses explicit admission order. Cancel/stop/delete removes wait intent. No reservation held while a tenant endlessly resolves media.
- Network interruption recovery is bounded and reconciles the same live session. Host restart marks current interrupted and never auto-replays it. Upcoming snapshot restoration needs a fresh authorized playback session, sufficient capacity and a one-time snapshot revision claim.
- Stored snapshot: schemaVersion, botId, chatId, queueRevision, createdAt, bounded stable metadata, consumedRevision. No assistant secrets, temp paths or expiring URLs. Skip removed/unavailable sources only under documented all-or-nothing vs reviewed-partial restore policy; initial default is all-or-nothing admission.
- DB outage: no new durable admissions, leases, destructive moderation or timed reversals based on stale authority. Bounded existing playback may continue only while lease ownership can be justified within grace; then stop safely. Keep help/health available. Recovery reconciles before restarting consumers.

## 5. Moderation logic

Authorize actor and target hierarchy, verify bot rights, validate reason/duration and record a case intent before Telegram action. Mark executed only after confirmed API result; uncertain timeouts reconcile observed member state where possible. Do not blindly retry a destructive action with changed target conditions.

Warn thresholds are versioned configuration. Crossing a threshold creates one sanction intent atomically; concurrent warnings cannot create duplicate bans. Removing a warning does not automatically reverse an existing sanction unless an authorized explicit reversal policy says so. Timed jobs carry case/sanction generation; renewals supersede older expiry jobs. Recheck bot rights and current sanction before unmuting.

Anti-flood uses bounded per-actor windows, documented exemptions and configurable graduated actions; avoid counting duplicate delivered updates twice. Anti-link parses safely and uses configurable domain rules; no default claim that every URL is malicious. Start both modules disabled/preview-only. Emergency lockdown is a later confirmed reversible group-admin action, not a platform-owner mass-ban shortcut.

Group upgrade/migration to supergroup needs an explicit chat-ID migration job. Atomically remap tenant settings, jobs and bindings where supported; pause affected music and revalidate rights. Do not let the old/new IDs operate competing queues.

## 6. Operational state machines

### Worker

registered → starting → running → draining → stopped; error, suspended and deleting are explicit states. Desired state and observed state stay separate. Restart has a unique operation ID; concurrent stop/restart is serialized, newest persisted operator intent wins. Startup checks token/config and obtains polling ownership before consuming updates. Failed token validation quarantines that bot only. Platform policy suspension overrides an owner's requested running state.

### Deletion

requested → access_revoked → runtime_stopped → secrets_removed → tenant_data_purging → completed. Confirmation shows scope and export option. Disable new work at access_revoked, fence assistant leases, cancel jobs and shared links, stop poller before token removal. Retry purge in batches with a tombstone that blocks late jobs/writes. Explain retained audit and backup expiry policy. Deleting our hosted registration does not delete the BotFather identity.

### Quotas

Reserve → commit/settle or expire/cancel. Atomic reservations prevent concurrent overspend. Count attempts separately from confirmed plays; failed playback must not inflate play statistics. Reservations have bounded validity checked by application, not TTL alone. Quota downgrade stops new excess work and offers a grace policy, rather than silently killing an active song. Security suspension can stop immediately and is not the same as billing downgrade.

### Safe degradation matrix

| Failure | Continue | Block / recover |
|---|---|---|
| Thumbnail/lyrics | ordinary player and commands | hide optional asset, expose retry if useful |
| One media provider | unaffected sources/moderation | breaker/backoff; no unapproved track substitution |
| Voice child crash | moderation, controller, diagnostics | mark session interrupted, reconcile native process/lease |
| Revoked worker token | other workers | quarantine affected poller; owner rotates token |
| Atlas unavailable | static help/health; bounded valid live stream only | durable mutations and uncertain lease activity |
| Disk pressure | controller/moderation | stop prefetch/download admission, remove unreferenced temp files; never delete active media blindly |
| Host memory/CPU pressure | essential policy/moderation first | cap new work, drain voice safely if necessary; no unbounded child respawn |

## 7. Suggested bounded launch settings

These are provisional configuration values requiring tests: multiple bots/owner within persisted plan limits and measured rollout capacity, one active call platform-wide, 20 queued tracks/group, 3 pending requests/member, 30-minute finite track maximum, one prefetch slot, 3 provider failures before breaker opens for 60 seconds, one half-open probe, 3 consecutive preparation failures before progression pauses. Download byte/disk/FFmpeg limits and protocol timeouts must be set after G0 measurements; unset critical limits fail config validation rather than mean unlimited.

Rate-limit scopes include actor+group, bot, provider and platform. Request cooldown and provider health state must not leak between unrelated tenants except documented global provider capacity protection. Counters/buffers/caches are bounded. Coalesce player-card edits; show progress on demand or at a modest configurable cadence, not every second for every group.

## 8. Acceptance scenarios

1. Two users enqueue when one slot remains: one commit succeeds, one receives capacity error; no negative quota.
2. Approve twice and redeliver engine end event: one insertion and one advancement.
3. Press old skip card after track changed: stale response, new track continues.
4. Restart worker during preparation: no duplicate poller/start; uncertain intent is reconciled.
5. Lose assistant lease while old child remains alive: old generation rejected/stopped before reassignment.
6. Stop while resolver/prefetch is running: late result cannot rejoin or enqueue new work.
7. Renew mute before old expiry fires: newer sanction remains.
8. Delete tenant while job retries: tombstone prevents resurrection; other tenants unaffected.
9. TypeTube returns private-network redirect: resolver denies fetch, no internal network request.
10. Language/rich renderer fails: escaped standard text reply works, permission checks unchanged.
11. Fair mode under repeated priority insertions: documented bound/explicit override is enforced and visible.
12. Run two groups on one assistant slot: busy group gets truthful status, active stream is not displaced.
13. Restore same snapshot twice under concurrent requests: saved tracks appended once, interrupted current excluded.
14. Group migrates chat ID: old jobs cannot modify a separately configured destination; rights/setup revalidated.
15. Database outage and recovery: no stale-lease parallel stream or delayed surprise moderation.

Each scenario requires automated policy/contract coverage and relevant real Telegram verification. Simulators do not prove audibility or Telegram permission behavior. Some foundational cases have offline contract coverage recorded in PHASE_0_ACCEPTANCE.md; these scenarios as full real-service acceptance remain unverified.

## 9. Scope discipline

G0 still proves one local file on one test call with the selected Python adapter and Render host. New G2/G4 features do not block that spike. Before implementation each item needs a schema, owner, error contract, capacity budget and acceptance evidence. Unresolved exact metrics/thresholds are configuration decisions to measure, not reasons to add fake dashboard values.


### Explicit owner playback destination (required)

Each clone owner can eventually choose `vc` (original Telegram group voice-chat output) or `webapp` (independent browser listening/player); default is VC. This is not permission for any room member to change the owner's bot mode. Configuration authorization is distinct from room listen/control permission. Destination changes require a new revision and a safe application boundary; never disconnect/release an assistant merely because a setting changed. Browser playback controls/timelines must not imply a Telegram VC operation completed.

Current source implements only the desired owner-scoped preference, a trusted-operator CLI and the operator VC startup guard. WebApp choice is unavailable for playback and must not fall back to VC; desired writes remain unapplied and do not migrate an active queue/session. Authenticated owner controls, full settings history/delivery/acknowledgement and actual WebApp playback remain required behind their existing safety gates.
