"""Single provisioned voice slot. No queue authority or tenant registration lives here."""
import asyncio
import json
import pathlib
import re
import uuid
from protocol import validate_request

class MediaRegistry:
    def __init__(self, root, handles, max_bytes=100 * 1024 * 1024):
        self.root = pathlib.Path(root).resolve(strict=True)
        if not self.root.is_dir() or not isinstance(handles, dict) or len(handles) > 20:
            raise ValueError('MEDIA_INVALID')
        self.handles = dict(handles)
        self.max_bytes = max_bytes
        for handle in self.handles:
            self.resolve(handle)
    def resolve(self, handle):
        relative = self.handles.get(handle)
        if not re.fullmatch(r'[A-Za-z0-9_-]{1,128}', handle) or not isinstance(relative, str) or pathlib.Path(relative).is_absolute():
            raise ValueError('MEDIA_INVALID')
        try:
            path = (self.root / relative).resolve(strict=True)
            if not path.is_relative_to(self.root) or not path.is_file() or not 0 < path.stat().st_size <= self.max_bytes:
                raise ValueError()
            return path
        except (OSError, ValueError):
            raise ValueError('MEDIA_INVALID') from None

class VoiceRuntime:
    def __init__(self, engine, media, bot_id, chat_id, session_id, generation, cache_limit=1024, lease_deadline=None):
        self.engine, self.media = engine, media
        self.lease_deadline = lease_deadline
        self.binding = (bot_id, chat_id, session_id, generation)
        self.revision = 0
        self.state = 'idle'
        self.active = False
        self.closed = False
        self.cache = {}
        self.cache_limit = cache_limit
        self.lock = asyncio.Lock()
        self.playback_request = None
        self.track_used = False
        self.terminal_emitted = False
    def event(self, request, kind, result):
        return dict(protocolVersion=1, eventId=uuid.uuid4().hex, requestId=request['requestId'],
                    sessionId=self.binding[2], leaseGeneration=self.binding[3], sessionRevision=self.revision,
                    eventType=kind, result=result)
    async def handle(self, value):
        request = validate_request(value)
        async with self.lock:
            if self.closed: raise ValueError('RUNTIME_CLOSED')
            if (request['botId'], request['chatId'], request['sessionId'], request['assistantLeaseGeneration']) != self.binding:
                raise ValueError('SESSION_MISMATCH')
            if self.lease_deadline and self.lease_deadline.expired() and request['operation'] not in {'stop', 'leave'}: raise ValueError('LEASE_EXPIRED')
            signature = json.dumps(request, sort_keys=True)
            previous = self.cache.get(request['requestId'])
            if previous:
                if previous[0] != signature: raise ValueError('REQUEST_ID_REUSED')
                return previous[1]
            if request['expectedRevision'] != self.revision: raise ValueError('STALE_REVISION')
            operation = request['operation']
            if operation == 'renew':
                if len(self.cache) >= self.cache_limit: raise ValueError('SESSION_REQUEST_LIMIT')
                if self.lease_deadline is None: raise ValueError('LEASE_UNAVAILABLE')
                self.lease_deadline.renew(request['payload']['leaseMs'])
                result = self.event(request, 'heartbeat', {'state': self.state})
                self.cache[request['requestId']] = (signature, result)
                return result
            if operation in {'health', 'reconcile'}:
                return self.event(request, 'heartbeat', {'state': self.state})
            if self.state == 'uncertain' and operation not in {'leave', 'stop'}: raise ValueError('SESSION_UNCERTAIN')
            if len(self.cache) >= self.cache_limit: raise ValueError('SESSION_REQUEST_LIMIT')
            path = None
            if operation in {'start-local-media', 'switch-local-media'}:
                if self.track_used: raise ValueError('TRACK_PROCESS_EXHAUSTED')
                path = self.media.resolve(request['payload']['mediaHandle'])
            if operation == 'pause' and self.state != 'playing': raise ValueError('STATE_INVALID')
            if operation == 'resume' and self.state != 'paused': raise ValueError('STATE_INVALID')
            if operation == 'switch-local-media' and self.state not in {'playing', 'paused'}: raise ValueError('STATE_INVALID')
            chat = int(self.binding[1])
            try:
                if operation in {'prepare/join', 'start-local-media', 'switch-local-media'}:
                    # Mark uncertain ownership before external work, so cleanup covers partial failures.
                    self.active = True
                    if path:
                        self.track_used = True
                        self.playback_request = request
                    await self.engine.play(chat, path)
                    self.state = 'playing' if path else 'joined'
                    kind = 'playback_started' if path else 'heartbeat'
                elif operation == 'pause':
                    if not await self.engine.pause(chat): raise RuntimeError()
                    self.state, kind = 'paused', 'paused'
                elif operation == 'resume':
                    if not await self.engine.resume(chat): raise RuntimeError()
                    self.state, kind = 'playing', 'resumed'
                else:
                    self.terminal_emitted = True
                    if self.active: await self.engine.leave(chat)
                    self.active = False
                    self.state, kind = 'idle', 'left'
                self.revision += 1
                event = self.event(request, kind, {'state': self.state})
            except Exception:
                self.state = 'uncertain'
                self.revision += 1
                event = self.event(request, 'failed', {'code': 'ENGINE_OPERATION_FAILED', 'state': self.state})
            self.cache[request['requestId']] = (signature, event)
            return event
    async def native_event(self, kind):
        async with self.lock:
            if kind not in {'media_ended', 'disconnected'}: raise ValueError('EVENT_INVALID')
            if self.closed or self.terminal_emitted or not self.playback_request or self.state not in {'playing', 'paused'}:
                return None
            self.terminal_emitted = True
            self.revision += 1
            self.state = 'ended' if kind == 'media_ended' else 'uncertain'
            result = {'state': self.state, 'playbackRequestId': self.playback_request['requestId']}
            if kind == 'disconnected': result['code'] = 'ASSISTANT_DISCONNECTED'
            return self.event(self.playback_request, kind, result)

    async def close(self):
        async with self.lock:
            if self.closed: return
            # Do not claim closed/clean if native teardown failed; caller must terminate process.
            self.terminal_emitted = True
            if self.active: await self.engine.leave(int(self.binding[1]))
            self.active = False
            self.closed = True
