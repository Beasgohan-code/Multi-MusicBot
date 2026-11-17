# Phase 0 — voice feasibility acceptance checklist

Status: Phase 0 implementation exists and passes the offline suites recorded below; real Telegram/Render acceptance is NOT RUN. Check boxes require the corresponding recorded evidence, not code existence.

Selected offline baseline: Python/Kurigram 2.2.26, PyTgCalls 2.3.3, ntgcalls 2.2.5; isolated Wzgram 3.1.7 compatibility failed. Earlier Node-first candidate ordering below is historical; apply the same behavior/security gates to the selected Python adapter.

## Goal and exclusions

Prove one assistant can stream permitted local audio to one Telegram test-group voice chat from the intended Render paid Docker worker, through the proposed Node-to-voice IPC boundary. Do not build clone onboarding, dozens of commands, a dashboard or source downloading first.

## Prerequisites (operator, outside chat)

- [ ] Dedicated test group; operator and assistant are members; voice chat started manually.
- [ ] Spare assistant account and local API ID/hash/session generation instructions. OTP/2FA entered only into the local interactive tool; session generated with the chosen client's own format.
- [ ] Permitted short local audio fixtures A/B, known durations, clearly distinguishable content. Never commit secrets or large generated media.
- [ ] Render paid worker approved by operator, outbound voice/network compatibility evaluated, secrets configured through deployment settings. No cloud resources provisioned merely by writing these docs.
- [ ] Exact Python MTProto/PyTgCalls/native binding versions, Python/runtime architecture support, repository/license, dependency licenses and build instructions recorded.
- [ ] MongoDB test database ready for the persistence/recovery part, with least-privilege user, TLS and workable restricted network access.

## Deliverables

- [ ] Minimal executable TypeScript orchestrator and one voice adapter, with validated configuration.
- [ ] Docker image includes pinned/controlled FFmpeg and native dependencies; non-root execution where supported.
- [ ] Versioned bounded IPC schema with request/event correlation, backpressure, sanitized errors and timeouts.
- [ ] Local assistant-session tool; .env.example contains placeholders only; .gitignore excludes sessions, .env and temporary audio.
- [ ] Explicit start/stop instructions and credential-redacted health diagnostics.
- [ ] Unit/contract tests and opt-in smoke-test instructions; CI never requires real account secrets.

## Local behavior gate

- [ ] Connect assistant, start engine in correct order, verify readiness and membership.
- [ ] Join existing test voice chat; start A; human confirms audible audio.
- [ ] Pause and resume; observed state matches acknowledgements.
- [ ] Switch A → B without unintended duplicate playback or session leak.
- [ ] Receive one effective end transition despite duplicate/stale event injection.
- [ ] Stop then leave; group confirms assistant disconnected; FFmpeg/native process cleaned up.
- [ ] Repeating stop/leave is safe; unsupported operations return actionable errors.
- [ ] Missing membership, speaking rights, absent call, bad session and invalid media handle fail safely; no automatic account login loop.

## Protocol, resource and isolation gate

- [ ] Distinguish accepted from playback_started; timeout/reconcile uncertain starts.
- [ ] Reject malformed/oversized requests, unknown operations, stale generation/revision and unauthorized media handles.
- [ ] Cap simultaneous calls at one; competing tenant gets a clear busy response, never displaces active playback.
- [ ] Duplicate request/event tests do not skip twice or start two streams.
- [ ] Kill voice child: orchestration detects failure, releases/reconciles call ownership, and remains responsive. No orphan FFmpeg or repeated unbounded spawn loop.
- [ ] Simulated moderation/runtime heartbeat stays responsive during voice failure; this is not a claim that moderation commands already exist in Phase 0.
- [ ] Signal container shutdown: bounded drain, child termination, connection cleanup and correct exit behavior.
- [ ] Secret scanning/redaction checks cover logs, fixtures, error traces, process arguments and protocol messages.

## Actual Render gate — cannot be replaced by local tests

- [ ] Record deployed commit, image/runtime/native versions, service type and region; sanitized logs only.
- [ ] Repeat join/play/pause/resume/switch/end/leave with human audibility confirmation.
- [ ] Run an initial 30-minute soak with repeated track changes; record CPU, peak memory, temporary disk and error counts. This is an initial feasibility test, not production capacity certification.
- [ ] Test temporary connection interruption/reconciliation where feasible; report tests that cannot be safely induced rather than marking pass.
- [ ] Restart worker mid-track: no automatic replay of old current track. Persist and offer upcoming metadata; explicit restoration preserves limits and is not duplicated.
- [ ] Verify no stale voice process/session remains and new playback can acquire the assistant lease.
- [ ] Confirm Atlas reachability, secret handling and temporary-file cleanup without public broad-access workarounds.

## Decision and evidence record

Complete a report with: date, commit, adapter repository/version, test case, expected/observed behavior, pass/fail/blocked, redacted log reference, human audibility confirmation, resource measurements, limitations and operator approval. Never include session strings, tokens, phone numbers, OTPs or API hashes.

- **PASS:** chosen adapter passes local + Render gates, no unresolved severe security/native-lifecycle faults; proceed to controller/clone implementation.
- **CLIENT COMPATIBILITY FAIL:** document a reproducible Wzgram/PyTgCalls blocker, evaluate the Kurigram baseline in a separate environment under the same gate, and select one tested client. A client switch requires locally generated compatible session credentials.
- **HOST FAIL:** test an approved voice-capable VPS/separate host; do not promise Render support or weaken security to force a pass.
- **BLOCKED:** missing credentials, hosting approval or voice test access means no live validation claim. Offline scaffolding/contract work can proceed, but phase acceptance remains pending.

No exact time or price is guaranteed. Operator must approve purchases. Source-service integrations, advanced moderation, simultaneous multi-assistant calls, billing and web synchronization require later acceptance suites.

## Implemented subset / evidence (2026-11-15)

The existing master roadmap implementation checklist records actual status. Framing/request validation, config validation, encrypted credential storage primitives and private session-file output are implemented and offline-tested. Orchestrator/adapter, event validation, deadlines, cleanup and journals now have offline coverage; the unchecked release gates above still require their real integration evidence. Historical checkpoints below show progress, not the current limitation list.

Offline compatibility commands (create each venv separately using its corresponding requirements file):

```sh
npm ci
npm run check
# Requires an isolated MongoDB test service; creates/drops a random music_test_* database:
TEST_MONGODB_URI='mongodb://...' npm run test:integration
# In the separately provisioned candidate/baseline environments:
.venv/bin/python scripts/check_voice_compatibility.py --client wzgram
.venv-kurigram/bin/python scripts/check_voice_compatibility.py --client kurigram
# LOCAL ONLY, requires real account credentials and network:
.venv-kurigram/bin/python scripts/generate_session.py
```

Observed: Wzgram probe exits 1 with ImportError (GroupcallForbidden); Kurigram probe exits 0, constructor only. Session-generation output is ignored .env.assistant, never printed. Scripts do not auto-load dotenv; the operator must provision its values into the execution environment. Keep credentials local; do not paste them into chat. Real Telegram credentials/group, MongoDB test target, FFmpeg and an approved Render worker are still required before live acceptance.

### Private child implementation usage / limits

The real child entrypoint is `apps/voice-engine/server.py`, using the isolated Kurigram baseline interpreter and environment settings listed in `.env.example`. The file is an example only; the child does not auto-load dotenv files. Operator must provision API_ID/API_HASH/ASSISTANT_SESSION and a fixed bot/chat/session/generation, read-only local fixture root and handle mapping. Automatic call creation is disabled. The TypeScript `VoiceProcess` class starts it over framed stdin/stdout, strips unrelated parent environment secrets, correlates completion events and terminates the process group on timeout/close. Native stdout banners are redirected to stderr; the parent discards raw stderr rather than leaking account details.

This is a bounded Phase 0 execution path, not a deployed player. The runner now integrates next-track handling, native terminal events, persistent leases, renewal and queue orchestration; live acceptance is still pending. Wrong/stale/malformed requests fail closed. A native operation error yields a sanitized failed event and an uncertain session requiring stop/leave; no automatic replay occurs. The hard session lifetime is not proof of durable lease safety. `playback_started` currently means PyTgCalls play returned successfully, not human-confirmed audibility.

Tests for the installed-library factory run with `.venv-kurigram/bin/python -m unittest discover -s tests/voice -v`; regular `npm run check` skips three optional-native tests if that environment is absent. Actual Telegram/Render checks above stay unchecked.

### Latest event/queue/lease evidence

Native stream-end/disconnect reporting is now implemented in the adapter/runtime/child/TypeScript transport, with duplicate and stop-late-event coverage. The previous command-results-only limitation is superseded. The runner increment below supersedes the missing renewal integration; the child safety cap remains.

Queue state and durable MongoDB lease repositories now exist, including opt-in real database tests in `tests/integration/playback-state.test.ts`; those tests remain skipped until TEST_MONGODB_URI is configured. An operator queue runner and authenticated supervisor are implemented; the full controller/factory integration is not. Native source identity safety currently requires one media track per child and child cleanup between tracks; this trades seamless switching for unambiguous completion identity.

Remaining environment blockers: no authenticated assistant/test-group configuration, no FFmpeg binary in this sandbox, no MongoDB test service, and no approved Render test deployment. Sandbox outbound networking is restricted and does not provide direct Telegram connectivity, so real Telegram verification must run in an approved external/local environment. No credentials should be pasted into chat. All live acceptance checkboxes stay unchecked; Phase 1 is not recommended yet.

### Runner increment evidence (2026-11-15; supersedes implementation limits above)

`PlaybackRunner` now connects persisted queue intents, guarded assistant leases, one Python child per track, terminal-event handling and cleanup-before-release. It polls persisted skip/stop/pause/resume changes. Renewal uses Mongo server-time guards and a conservative renewable monotonic deadline in Python; replayed renewal requests do not extend that deadline. The 3600-second child safety cap remains. Metadata recovery never clears an in-process quarantine or resets an assistant lease.

Operator entrypoint: `npm run phase0 -- --enqueue fixture-a --enqueue fixture-b`. It requires the execution settings in `apps/bot-runtime/execution-config.ts`, an existing enabled assistant record and an accessible Mongo database; it does not provision accounts, load dotenv files or create a Telegram call. `--recover` saves upcoming metadata without replaying a previous start. This entrypoint now uses grant-authenticated worker claim/heartbeat/finish but is not approved for concurrent fleet deployment. Keep all credentials in local environment/secrets, not command arguments or chat.

Verified locally: `npm run check` passes TypeScript build, **40 Node tests**, and **21 Python tests with 3 native-library skips** (24 total). The isolated Kurigram suite passes **24/24**, including constructor/update-type checks; these are offline checks, not Telegram playback. Runner doubles cover duplicate end, reap/release order, uncertain cleanup, renewal success/failure, persistence failure, cleanup DB outage, persisted skip/pause/resume, disconnect and quarantine surviving metadata recovery. Real child transport tests cover leave/idle acknowledgement and normal process exit. `npm run test:integration` still reports **3 skips**, with no configured Mongo target.

Still incomplete: abandoned-lease reconciliation, cancellation/late-settlement handling for bounded operations, durable terminal journal/atomic transition audit, authenticated controller wiring, worker lifecycle/restart policy, real Mongo failure matrix and actual Telegram/Render verification. `WorkerRegistry` is an internal repository with grant-derived ownership and guarded claim/heartbeat primitives, now used by the operator supervisor; grants/slots still require trusted operator provisioning. Structured audit inserts are whitelisted but not atomic with queue transitions. No live acceptance checkbox is satisfied by these tests. Phase 0 remains incomplete.

### Shared Telegram presentation evidence (2026-11-15)

User-requested Videl0 emoji extraction adds `packages/bot-ui` with 664 aliases / 611 unique IDs from its pinned production catalogue, preserving Unicode fallbacks. Data-only extraction uses AST literals rather than executing upstream modules. Shared welcome/fleet/settings/player/queue/error templates escape dynamic text and apply one capability policy; buttons/toasts remain Unicode. There are no active Telegram handlers yet, so this is not evidence of a running UI migration or live custom-emoji eligibility. README now distinguishes existing prototype code from the target clone-platform structure and onboarding flow. Latest `npm run check`: build PASS, 44 Node tests PASS; Python 21 PASS / 3 native-library SKIP. These UI additions do not close any live Phase 0 playback/controller gate.

### Worker authorization dependency increment (2026-11-15)

Repository audit found that worker heartbeat renewed ownership before suspension checking and did not authenticate grant revocation. Fixed with red → green worker tests: heartbeat now validates explicit bot/owner/worker/generation fields and authenticates the original grant hash before a server-expiry-guarded renewal. Cleanup reports match the original token hash and exact holder/generation, even after grant revocation, so a revoked holder can still quarantine itself. Unit coverage includes invalid generations, cross-bot grant use, suspension, DB failure, stale ownership and fenced cleanup. Grant/suspension reads and worker renewal span collections and are not atomic with concurrent revocation; a complete supervisor/deadline path is still required. `finish(clean)` remains an internal trusted-cleanup contract, not an external authorization API.

Worker schema change: new claims persist `grantHash`; existing active slots without it cannot renew or finish through this version. Reconcile and prove cleanup before re-provisioning; never reset an unknown live holder. No auto-migration or runtime reset is performed.

Validation: build + 50 Node tests pass; regular Python 21 pass / 3 skip; isolated native environment 24 pass. Added `tests/integration/workers.test.ts`; all four real Mongo tests skip without TEST_MONGODB_URI. Phase 0 voice files were not changed. Expanded architecture is a target and implementation map, not acceptance of factory/settings/web functionality.

### Authenticated operator supervisor / abandonment increment (2026-11-15)

The operator runner now requires WORKER_GRANT and authenticates/claims the registry before queue setup. Expected-bot checking, bounded serialized heartbeats, stop propagation, drain-before-finish and conservative quarantine are implemented in `apps/bot-runtime/supervisor.ts`. A latched runner stop prevents an early cancellation from being forgotten. Uncertain cleanup and failed cleanup persistence reject execution, rather than exiting as fake success. Operator-provisioned bot/grant/worker records remain required; no onboarding endpoint exists.

`AbandonedOwnership` methods atomically quarantine exact expired holder/generation observations and append a safe embedded outbox event. Assistant ownership remains leased, never automatically available. DB errors propagate; stale/unexpired/nonmatching observations return no transition. Pending outbox events are bounded to 100 with fail-closed backpressure. This repository is not yet a scheduled reconciler, cleanup-evidence verifier or full audit relay.

TDD evidence: missing modules/failing behavior tests observed before implementation; final `npm run check` passes TypeScript build + **63 Node tests**, Python **21 pass / 3 native skips**. `npm run test:integration` has **5 explicit skips** without TEST_MONGODB_URI. New tests cover supervisor authorization order, bot mismatch, graceful drain, runtime error, uncertain cleanup, delayed heartbeat, renewal/cleanup DB outages, and reconciliation CAS/outbox filters. They are not verified multi-process/Mongo failure tests. Native Python implementation is unchanged.

Still blocking safety acceptance: trustworthy host-crash native cleanup and release, scanner/operator reconciliation tooling, complete worker/assistant transition audit and outbox delivery, late-operation settlement, full lifecycle/readiness/restart policy, real DB/Telegram/Render failures. Do not onboard clones or clear quarantine manually based on elapsed time.

### Atomic ownership audit and operator maintenance evidence (2026-11-15)

Worker claim/heartbeat/finish and assistant acquire/renew/release now atomically append safe ownership events with their mutations. Pending event capacity is 100 per source document; when full the mutation fails closed (including release) until a trusted relay drains it. Release captures original tenant/holder/generation before clearing fields. `OwnershipOutbox` archives by unique event ID, then acknowledges; repeated delivery after a crash cannot create a second event identity. Invalid payloads and archive/ack failures leave pending evidence rather than fabricating success.

`phase0:maintain` is a restricted operator batch, authorized by local Mongo credentials, not an onboarding/admin API. It flushes, scans bounded expired-holder candidates, quarantines through exact CAS guards, and flushes again. Supervisor heartbeat/finish also relay ownership events. Batch output explicitly reports `cleanupConfirmed:false`. No new idle/stopped takeover path exists.

Verified: build + **70 Node tests pass**; regular Python **21 pass / 3 skips**; isolated native suite **24 pass**. Real Mongo integration **6 skips**, including a release-and-relay test that seeds the archive-before-ack crash window. Unit tests establish contract/update shapes, not Mongo aggregation correctness. Existing earlier statements that all ownership transition auditing and relay are absent are superseded for these implemented operations only. Queue terminal journaling, trusted host cleanup/release, late-operation/drain safety and live crash/outage acceptance remain incomplete. Phase 0 safety gate is still open and factory onboarding remains disabled.


### NEXT cycle: settle timed-out native shutdown before finishing the holder (2026-11-15)

A failing regression test demonstrated that runner cleanup used Promise.race as if timeout cancelled native shutdown. `runOne()` could reject and let the supervisor finish the worker while its child shutdown promise was still pending. It now marks the runner blocked, emits best-effort cleanup uncertainty, and awaits actual shutdown settlement before rejecting the original failure. A late clean result does not authorize assistant release; a late rejection is observed without an unhandled rejection. Metadata recovery remains unavailable while that run is draining.

TDD: the delayed-cleanup regression failed before the fix; final `npm run check` passes build + **72 Node tests**, regular Python **21 pass / 3 skip**. Isolated Kurigram suite **24 pass**; six real Mongo tests skip without a configured target. `npm audit --omit=dev` reports zero known production-dependency vulnerabilities; this is not a security audit. No lint script/config is currently available. New regressions use test-only children, not real native cleanup acceptance.

Deliberate limitation: a shutdown promise that never settles keeps the run pending. This sacrifices availability rather than falsely completing/restarting a live holder. Existing VoiceProcess owns process-group termination; trusted host crash cleanup, verified process-group disappearance and bounded escalation still require acceptance. Other late acquire/renew/queue DB operations are not fixed by this increment. No new safe-unquarantine path or clone onboarding was enabled.

### NEXT cycle: settle late assistant acquisition (2026-11-15)

A failing regression reproduced the runner finishing while a timed-out acquire could still succeed and orphan ownership. The runner now holds the exact acquisition promise to settlement, blocks replay, and never starts a child or writes a start intent from a late result. Known late success captures its generation and uses the existing holder/generation-guarded release, valid only because this path has never constructed a child. Late rejection preserves the original timeout and does not pretend release occurred; database outcomes without a returned generation remain for quarantine reconciliation. Failed compensation retains ownership and the blocked runner even after metadata recovery. No retry/read-back inference is used.

New test-only deferred lease cases cover late success, late rejection and compensation DB failure; they are not real network/Mongo evidence. `npm run check`: build/typecheck + **75 Node PASS**, Python **21 PASS / 3 SKIP**. Targeted runner suite **16 PASS**. Isolated Kurigram **24 PASS**; real Mongo suite **6 SKIP** without TEST_MONGODB_URI. Lint remains unconfigured. Shutdown/acquisition promises that never settle intentionally keep the holder pending. Late renewal, queue/release mutations, process-group escalation and host cleanup proof remain unfinished; onboarding stays disabled.

### NEXT cycle: late renewal settlement and native-first interruption (2026-11-15)

Three red regressions exposed early release/holder completion while Mongo renewal was unresolved and a completion/renewal-failure race consuming upcoming metadata. The runner now retains the exact renewal promise, blocks reuse on failed/timed-out DB renewal, and performs one shared native shutdown before interruption persistence. It waits for that renewal to settle before guarded assistant release and before finishing the run, including when teardown or queue persistence fails. Late DB results cannot issue child renewal or retry playback. Release still requires clean native teardown and the original holder/generation; uncertain cleanup never releases. A completion racing failed renewal is conservatively interrupted; timely valid renewal still permits one completion transition.

Six added test-only scenarios cover late success/rejection, uncertain cleanup, queue persistence outage, completion/failed-renewal overlap and timely completion/renewal overlap. Native shutdown is memoized so error/finally paths do not invoke it twice. Targeted runner suite: **22 PASS**. `npm run check`: build/typecheck + **81 Node PASS**, regular Python **21 PASS / 3 SKIP**. Isolated Kurigram **24 PASS**; real Mongo **6 SKIP** without a configured URI; lint remains unconfigured. These tests use deferred doubles, not real database/process-failure acceptance.

An unresolved DB renewal intentionally keeps the run pending even after native teardown. This is not bounded drain or a host cleanup-proof workflow. Late queue/release mutation settlement and queue terminal journaling remain unfinished; live Mongo/Telegram/Render gates and clone onboarding remain blocked.

### Late queue/release settlement increment

Runner retains exact outstanding queue mutations and cleanup release promises beyond their deadlines. Native teardown precedes draining late queue writes; guarded lease release and holder completion wait for settlement, without retries or late success audit. Recovery excludes concurrent run/recovery. Timeout blocks this runner; a late begin/completion may still persist and requires explicit recovery, not replay. Never-settling operations deliberately retain the holder. Durable terminal journaling, host-crash cleanup and real Telegram/Mongo/Render acceptance remain separate gates. Playeon lounge ideas and restrictive licensing are recorded in SOURCE_COMPARISON.md; onboarding and lounge implementation remain gated.

Offline verification for this increment: `npm run check` passed build/typecheck, 87 Node tests and 21 Python tests (3 optional-native skips). Runner coverage is 28 tests, including four regressions first observed failing and late rejection/failed-cleanup cases. Isolated Kurigram `unittest discover -s tests/voice -v`: 24 passed. `npm run test:integration`: 6 skipped without Mongo configuration; not database correctness evidence. No lint script exists. No live Telegram/Render playback was performed.

### Terminal acknowledgement truthfulness

A correlated native terminal event alone no longer authorizes a successful runner result or completion/advancement audits. The source-bound queue CAS must report that it applied. If skip, stop, recovery or interruption supersedes the source before persistence, the runner fails closed with `TERMINAL_NOT_APPLIED`, reaps the child, performs exact guarded release only after cleanup, and remains blocked. This is conservative rejection, not reconciliation or a durable terminal journal. Normal successful CAS retries remain bounded and duplicate events do not advance twice. Durable receipt/outbox journaling and real process-crash acceptance remain unfinished; onboarding stays disabled.

Verification: three new runner regressions failed before the fix; runner now 31/31 passed. `npm run check`: build/typecheck passed, 92 Node passed, regular Python 21 passed/3 optional-native skipped. Isolated Kurigram: 24 passed. Mongo integration: 6 skipped (no configured target), not real persistence/crash proof. No lint script or live Telegram/Render verification. Two additional queue-event tests cover successful retry and three-attempt contention exhaustion.

### Atomic terminal receipt evidence

The queue's atomic CAS now includes a bounded terminal receipt for accepted end/disconnect, preserving source, track ID, outcome and committed revision through recovery/stop. No arbitrary track metadata or source extensions enter receipts. Unit tests demonstrate unchanged input on capacity failure, legacy initialization, duplicate rejection, full-journal start rejection, and a collection double committing the queue/receipt then losing its acknowledgement; a reconstructed repository sees one receipt and rejects replay. This is a failure simulation, not a real process/network failure test.

`npm run check`: build/typecheck PASS, **100 Node PASS**, regular Python **21 PASS / 3 optional-native SKIP**. Recreated ignored isolated Kurigram environment from the committed lockfile; **24 Python PASS**. `npm run test:integration`: **7 SKIP** without a configured Mongo target, including new real Mongo concurrent terminal receipt/reconstruction test. `npm ci`: audit reports 0 vulnerabilities. No lint script exists; `git diff --check` passes. No live Telegram or Render test performed.

The operator archive/ack relay below now frees pending capacity only after archive success. At 100 pending receipts, terminal mutation and new playback binding still fail closed; stop/recovery never discard evidence. Committed receipt persistence is not a full durable terminal-event transport, independent audit relay, or native cleanup proof. Onboarding remains disabled.


### Terminal relay and full-document reconciliation evidence

All eight repository Markdown files reviewed and reconciled with source; historical checkpoint counts do not represent current acceptance. Terminal archival is now exposed through the bounded trusted operator maintenance CLI. Archive and acknowledgement request majority write concern and reject unacknowledged responses. Receipt acknowledgement requires the observed queue revision and increments it; stale queue replacement is rejected, and concurrent mutation/relay conflicts retain evidence for a fresh batch. Archive identity is bot+chat+receipt revision with immutable payload collision protection. The relay neither replays playback nor releases ownership. Prefer running while playback is drained; automatic serialized runtime delivery remains unfinished.

TDD: initial missing-module RED plus two observed unacknowledged-write regressions RED; **12 relay tests PASS**, including outage/replay, CAS race, stale replacement, strict scope/payload, duplicate-revision rejection, identity collision and full-journal capacity recovery. `npm run check`: build/typecheck PASS, **112 Node PASS**, **21 Python PASS / 3 optional-native SKIP**. Isolated locked Kurigram: **24 PASS**. Real Mongo: **8 SKIP**, including new relay scope/CAS test, because no target is configured. `npm audit --omit=dev`: 0 known advisories. `git diff --check` PASS; no lint script. Unit collection doubles are not Mongo rollback/process-crash acceptance. No live Telegram or Render tests performed; all live release gates remain unchecked and onboarding disabled.


### Supervisor heartbeat settlement evidence

Five deferred-operation regression tests were observed failing before implementation: initial heartbeat late success/rejection, active heartbeat late success/rejection and runtime cleanup failure with pending heartbeat. The supervisor now retains the original registry promise after its deadline, aborts work promptly, and waits for both work drain and heartbeat settlement before exact fenced finish. Initial timeout never starts work; late results never restore readiness, retry heartbeats or permit a successful ownership-loss result. Three additional tests preserve timely heartbeat completion and awaited late finish success/rejection without duplicate finish attempts.

Verification: targeted supervisor suite **16 PASS**; `npm run check` build/typecheck + **120 Node PASS**, regular Python **21 PASS / 3 optional-native SKIP**; isolated `.venv-kurigram/bin/python -m unittest discover -s tests/voice -v` **24 PASS**; `npm run test:integration` **8 SKIP** without Mongo configuration. No lint script exists. These new cases use deferred registry doubles, not real Mongo/network/native cleanup proof. Unresolved heartbeat/finish deliberately keeps the holder pending; bounded host/process-group escalation, cleanup attestation and live Telegram/Render gates remain unfinished. Onboarding remains disabled.


### Single-flight voice cleanup and real local subprocess checks

Three cleanup regressions failed before implementation: concurrent shutdown callers disrupted the pending leave and returned false cleanup; repeated shutdown lost its original result; concurrent close calls created separate reap promises. `VoiceProcess` now shares one shutdown attempt/result and one close operation for each child. Existing clean-ack, normal exit, group absence and forced-exit rejection checks are preserved.

New test-only Node subprocess fixtures (no credentials/media/Telegram) exercise normal child plus same-group descendant reaping, and a SIGTERM-resistant child requiring the existing two-second SIGKILL escalation. A separate close test confirms the child remains alive after ignored SIGTERM, close stays pending, then escalation reaps it. Individual PID and negative-PGID probes confirm those processes/groups are gone. The forced-exit case runs through the real playback runner, using in-memory queue/lease doubles: `CLEANUP_UNCERTAIN`, ownership retained, release never invoked, cached shutdown remains false. This is OS transport evidence only, not native-call cleanup or host-crash proof. POSIX-specific group tests skip on Windows.

Verification: targeted voice-process suite **13 PASS**; `npm run check` build/typecheck + **126 Node PASS**, regular Python **21 PASS / 3 optional-native SKIP**; isolated locked Kurigram **24 PASS**. Real Mongo suite **8 SKIP** without configured test service. No lint script; `git diff --check` passes. Actual Telegram audibility, PyTgCalls/FFmpeg process-tree behavior, escaped descendants, unkillable processes, bounded host cleanup and Render acceptance remain unverified. No new safe-unquarantine path; onboarding stays disabled.


### Bounded process-group observation evidence

TDD: missing helper and two behavioral regressions observed RED before implementation: delayed original-group disappearance was rejected immediately; non-ESRCH signal failure was swallowed and could report clean. A monotonic bounded post-reap observer now requires ESRCH; present waits up to two seconds in production, unknown fails immediately, and neither path leaves background probes. Signal permission/unknown errors latch cleanup uncertainty. Group evidence is cached with the single-flight close, not refreshed from an old PID on repeated shutdown calls. Close disposal completion is not authorization to reuse an assistant.

`tsx --test tests/unit/process-group.test.ts tests/unit/voice-process.test.ts`: **25 PASS** (7 group helpers / 18 transport tests). Fault injection covers delayed/persistent/unknown group probes, signal EPERM, deadline validation/zero budget, invalid/reserved identities, no background probes and no re-probe after cached failure. The transport tests run real Node children, but injected syscall outcomes are not actual EPERM/unkillable-process experiments. Spawn failure is also covered; existing real descendant/reap/SIGKILL cases remain passing.

`npm run check`: build/typecheck PASS, **138 Node PASS**, regular Python **21 PASS / 3 optional-native SKIP**. Locked isolated Kurigram **24 PASS**. Real Mongo **8 SKIP** without a configured target. `npm audit --omit=dev`: 0 known advisories; lint script absent. No live Telegram/native-call or Render test. The bound starts after immediate-child reap; unresolved reap, escaped descendants, remote-host cleanup, process-tree containment and actual PyTgCalls/FFmpeg verification remain incomplete. No new cleanup attestation or safe-unquarantine capability; onboarding stays disabled.


### Shutdown admission / Docker packaging checkpoint

Four shutdown admission tests retain the normal internal leave while rejecting public IPC after synchronous shutdown entry (including public leave), after a microtask yield, with pending work, and without prior binding. The initial two admission regressions failed RED (`VOICE_BUSY` rather than permanent `VOICE_CLOSED`) before introducing a separate private send path. Existing clean/uncertain/repeated/concurrent cleanup checks still pass.

Dockerfile and `.dockerignore` added after three observed missing-file RED contract tests. Image design: Node 22 compiled runner with production dependencies only, Python 3.11 isolated locked Kurigram/native stack, FFmpeg, tini and non-root execution. Explicit copies/context exclusions keep secrets, sessions, local environments and media out of the image. README gives Docker smoke commands and a private Render checklist; a drained queue exits and automatic restart must not repeat enqueue requests. No polling UI, HTTP server, factory or cloud provisioning is implied.

Verification: build/typecheck + **145 Node PASS**, regular Python **21 PASS / 3 SKIP**, isolated native-baseline Python **24 PASS**, Mongo **8 SKIP** without target. No lint script. **Docker build/run NOT RUN (engine unavailable)**; these three packaging tests inspect files, not an image. Native ABI/FFmpeg versions, resolved base digests, actual Render networking/resource/termination behavior, real Mongo and human-confirmed Telegram audibility remain required. No deployment or secrets requested in chat; onboarding stays disabled.


### VC / WebApp mode preference boundary

Missing-module RED observed before `PlaybackPreferences` implementation. Ten unit tests verify owner/non-suspended bot scope, legacy VC default, desired-only revision CAS, concurrent/duplicate conflicts, validation, malformed persistence, suspension/transfer write predicates, unknown network/write acknowledgements and no implicit WebApp-to-VC fallback. They use in-memory collection doubles, not actual Mongo concurrency. A ninth opt-in Mongo integration test now checks persistence reconstruction, CAS, tenant denial, suspension and the VC guard; it is SKIPPED without `TEST_MONGODB_URI`.

The actual VC script reads the authenticated binding's bot/owner preference before queue initialization or assistant access. Selecting WebApp blocks startup with a sanitized stable error; it does not create browser playback. Operator CLI reads/requests desired preference using trusted database access, not Telegram owner authentication. Desired changes are startup snapshots, never cleanup evidence or active-call migration. No applied acknowledgement, history/outbox, owner menu, WebApp authentication/media server or frontend is claimed.

Verification: build/typecheck PASS, **155 Node PASS**, regular Python **21 PASS / 3 SKIP**, locked isolated Kurigram **24 PASS**, real Mongo **9 SKIP** without target. No lint script. Actual VC, Docker image, Render feasibility and browser playback remain NOT VERIFIED. Future acceptance must prove unauthorized/expired/revoked/cross-bot WebApp denial, secret-safe media delivery, real playback/autoplay/error state and no browser-to-VC control confusion before enabling that destination.


### Separate Playeon personal-evaluation checkpoint

User-requested direct clone is persisted under `vendor/playeon` with original author Sushi / Playeon Project, original license and exact pinned baseline provenance. It is not the Python VC adapter, not wired into owner mode selection, and not covered by platform lease/tenant guarantees. Only five documented files are modified (privacy syntax, system-font layout, bot lockfile and web package/lockfiles). Two integrity/regression tests were observed RED before the corresponding vendoring/fixes.

Actual vendor bot typecheck and Next production build PASS after fixes; full dependency audits bot/web 0 known advisories. Vendor web lint FAIL (4 errors / 11 warnings); no suppression or readiness claim. Root build/typecheck PASS, Node **157 PASS**, regular Python **21 PASS / 3 SKIP**, Mongo **9 SKIP** without configured target. Isolated native suite not rerun in this upstream-only slice. No real Mongo/Redis, Telegram login/playback, browser room session, Docker image or Render test. Instructions require own origins and production auth mode; upstream development bypass and host defaults must not be exposed. Personal use only under upstream license until applicable written commercial permission exists. The original platform Phase 0 gates remain unpassed.
