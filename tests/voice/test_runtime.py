import pathlib
import sys
import tempfile
import unittest
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[2] / 'apps' / 'voice-engine'))
from runtime import VoiceRuntime, MediaRegistry

class EngineDouble:
    def __init__(self): self.actions = []; self.fail = False
    async def play(self, chat, path=None):
        self.actions.append(('play', chat, path))
        if self.fail: raise RuntimeError('secret account details')
    async def pause(self, chat): self.actions.append(('pause', chat)); return True
    async def resume(self, chat): self.actions.append(('resume', chat)); return True
    async def leave(self, chat): self.actions.append(('leave', chat))

def request(operation, revision=0, **changes):
    return dict(protocolVersion=1, requestId=f"{operation.replace('/', '-')}-{revision}", botId='123', chatId='-1001', sessionId='s1', assistantLeaseGeneration=4, expectedRevision=revision, operation=operation, payload={}, **changes)

class RuntimeTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.path = pathlib.Path(self.temp.name) / 'audio.wav'; self.path.write_bytes(b'fixture')
        self.engine = EngineDouble()
        self.runtime = VoiceRuntime(self.engine, MediaRegistry(self.temp.name, {'a': 'audio.wav'}), '123', '-1001', 's1', 4)
    async def asyncTearDown(self): self.temp.cleanup()
    async def test_start_pause_resume_leave_and_revision(self):
        r = request('start-local-media')
        r['payload'] = {'mediaHandle': 'a'}
        event = await self.runtime.handle(r)
        self.assertEqual(event['eventType'], 'playback_started')
        self.assertEqual(event['sessionRevision'], 1)
        self.assertEqual((await self.runtime.handle(request('pause', 1)))['eventType'], 'paused')
        self.assertEqual((await self.runtime.handle(request('resume', 2)))['eventType'], 'resumed')
        self.assertEqual((await self.runtime.handle(request('leave', 3)))['eventType'], 'left')
        self.assertEqual([a[0] for a in self.engine.actions], ['play', 'pause', 'resume', 'leave'])
    async def test_dedup_and_conflicting_reuse(self):
        r = request('prepare/join')
        first = await self.runtime.handle(r)
        self.assertEqual(await self.runtime.handle(r), first)
        self.assertEqual(len(self.engine.actions), 1)
        with self.assertRaisesRegex(ValueError, 'REQUEST_ID_REUSED'):
            await self.runtime.handle({**r, 'operation': 'pause'})
    async def test_wrong_tenant_lease_session_and_revision_rejected_before_engine(self):
        for patch in [dict(botId='999'), dict(chatId='-999'), dict(sessionId='other'), dict(assistantLeaseGeneration=3), dict(assistantLeaseGeneration=5), dict(expectedRevision=1)]:
            with self.assertRaisesRegex(ValueError, 'SESSION_MISMATCH|STALE_REVISION'):
                await self.runtime.handle({**request('prepare/join'), **patch})
        self.assertEqual(self.engine.actions, [])
    async def test_failed_engine_does_not_report_success_and_requires_cleanup(self):
        self.engine.fail = True
        r = request('start-local-media'); r['payload'] = {'mediaHandle': 'a'}
        event = await self.runtime.handle(r)
        self.assertEqual(event['eventType'], 'failed')
        self.assertNotIn('secret', str(event))
        self.assertEqual(await self.runtime.handle(r), event)
        with self.assertRaisesRegex(ValueError, 'SESSION_UNCERTAIN'):
            await self.runtime.handle(request('prepare/join', 1))
        await self.runtime.close()
        self.assertEqual(self.engine.actions[-1][0], 'leave')
    async def test_unknown_media_and_pause_idle_denied(self):
        r = request('start-local-media'); r['payload'] = {'mediaHandle': 'missing'}
        with self.assertRaisesRegex(ValueError, 'MEDIA_INVALID'): await self.runtime.handle(r)
        with self.assertRaisesRegex(ValueError, 'STATE_INVALID'): await self.runtime.handle(request('pause'))
        self.assertEqual(self.engine.actions, [])
    async def test_allowlist_denies_escape_and_symlinks(self):
        for name in ['../outside.wav', '/etc/passwd']:
            with self.assertRaisesRegex(ValueError, 'MEDIA_INVALID'): MediaRegistry(self.temp.name, {'a': name})
        link = pathlib.Path(self.temp.name) / 'link.wav'; link.symlink_to('/etc/passwd')
        with self.assertRaisesRegex(ValueError, 'MEDIA_INVALID'): MediaRegistry(self.temp.name, {'a': 'link.wav'})
    async def test_cleanup_idempotent(self):
        await self.runtime.handle(request('prepare/join'))
        await self.runtime.close(); await self.runtime.close()
        self.assertEqual([a[0] for a in self.engine.actions], ['play', 'leave'])
        with self.assertRaisesRegex(ValueError, 'RUNTIME_CLOSED'): await self.runtime.handle(request('health', 1))

    async def test_native_end_is_deduplicated_and_not_confused_with_stop(self):
        r = request('start-local-media'); r['payload'] = {'mediaHandle': 'a'}
        await self.runtime.handle(r)
        event = await self.runtime.native_event('media_ended')
        self.assertEqual(event['eventType'], 'media_ended')
        self.assertEqual(event['result']['playbackRequestId'], r['requestId'])
        self.assertIsNone(await self.runtime.native_event('media_ended'))
        self.assertEqual(event['sessionRevision'], 2)
        # An untagged native callback must never be attributed to a new track in the same child.
        with self.assertRaisesRegex(ValueError, 'TRACK_PROCESS_EXHAUSTED'):
            await self.runtime.handle({**request('start-local-media', 2), 'payload': {'mediaHandle': 'a'}})

    async def test_stop_suppresses_late_end_and_disconnect_does_not_complete(self):
        r = request('start-local-media'); r['payload'] = {'mediaHandle': 'a'}
        await self.runtime.handle(r)
        event = await self.runtime.native_event('disconnected')
        self.assertEqual(event['eventType'], 'disconnected')
        self.assertEqual(event['result']['code'], 'ASSISTANT_DISCONNECTED')
        self.assertIsNone(await self.runtime.native_event('media_ended'))
        await self.runtime.handle(request('stop', 2))
        self.assertIsNone(await self.runtime.native_event('media_ended'))

    async def test_renew_replay_does_not_extend_deadline_and_expiry_fails_closed(self):
        from lease_deadline import LeaseDeadline
        now = [0.0]
        self.runtime.lease_deadline = LeaseDeadline(1000, clock=lambda: now[0])
        r = request('renew'); r['payload'] = {'leaseMs': 1000}
        now[0] = 0.5
        first = await self.runtime.handle(r)
        self.assertEqual(first['eventType'], 'heartbeat')
        now[0] = 1.25
        self.assertEqual(await self.runtime.handle(r), first)
        now[0] = 1.5
        with self.assertRaisesRegex(ValueError, 'LEASE_EXPIRED'):
            await self.runtime.handle(r)
