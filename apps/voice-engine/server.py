"""Private, bounded-duration Phase 0 voice child. No public API or credential prompts."""
import asyncio
import contextlib
import io
import json
import os
import re
import signal
import sys
from protocol import MAX_FRAME_BYTES, read_frame, write_frame, validate_request
from runtime import VoiceRuntime, MediaRegistry
from lease_deadline import LeaseDeadline

async def read_async_frame(reader):
    try:
        header = await reader.readexactly(4)
    except asyncio.IncompleteReadError as error:
        if not error.partial: return None
        raise ValueError('FRAME_INVALID') from None
    length = int.from_bytes(header, 'big')
    if not 0 < length <= MAX_FRAME_BYTES: raise ValueError('FRAME_INVALID')
    try:
        body = await reader.readexactly(length)
    except asyncio.IncompleteReadError:
        raise ValueError('FRAME_INVALID') from None
    return read_frame(io.BytesIO(header + body))

def load_settings(env):
    try:
        api_id = int(env['API_ID'])
        api_hash = env['API_HASH']
        session = env['ASSISTANT_SESSION']
        generation = int(env['VOICE_GENERATION'])
        binding = dict(protocolVersion=1, requestId='config', botId=env['VOICE_BOT_ID'], chatId=env['VOICE_CHAT_ID'], sessionId=env['VOICE_SESSION_ID'], assistantLeaseGeneration=generation, expectedRevision=0, operation='health', payload={})
        validate_request(binding)
        ttl = int(env.get('VOICE_MAX_SECONDS', '120'))
        if api_id <= 0 or not re.fullmatch(r'[a-fA-F0-9]{32}', api_hash) or not re.fullmatch(r'[A-Za-z0-9_=-]{1,8192}', session) or not env['VOICE_CHAT_ID'].startswith('-') or not 1 <= ttl <= 3600:
            raise ValueError()
        handles = json.loads(env['VOICE_MEDIA_HANDLES'])
        media = MediaRegistry(env['VOICE_MEDIA_ROOT'], handles)
        return api_id, api_hash, session, binding, ttl, media
    except (KeyError, ValueError, TypeError, OSError):
        raise ValueError('VOICE_CONFIG_INVALID') from None

async def run():
    api_id, api_hash, session, binding, ttl, media = load_settings(os.environ)
    if not __import__('shutil').which('ffmpeg'):
        raise RuntimeError('FFMPEG_REQUIRED')
    from native_adapter import create_adapter
    adapter = create_adapter(api_id, api_hash, session)
    lease = LeaseDeadline(int(os.environ.get('VOICE_LEASE_MS', str(min(ttl*1000,60000)))))
    runtime = VoiceRuntime(adapter, media, binding['botId'], binding['chatId'], binding['sessionId'], binding['assistantLeaseGeneration'], lease_deadline=lease)
    loop = asyncio.get_running_loop()
    task = asyncio.current_task()
    for sig in (signal.SIGINT, signal.SIGTERM):
        loop.add_signal_handler(sig, task.cancel)
    reader = asyncio.StreamReader(limit=MAX_FRAME_BYTES + 4)
    transport, _ = await loop.connect_read_pipe(lambda: asyncio.StreamReaderProtocol(reader), sys.stdin.buffer)
    output = asyncio.Queue(maxsize=32)
    def enqueue(event):
        try: output.put_nowait(event)
        except asyncio.QueueFull: task.cancel()  # Fail closed on undeliverable native events.
    async def native_sink(chat, kind):
        if str(chat) != binding['chatId']: return
        event = await runtime.native_event(kind)
        if event: enqueue(event)
    adapter.subscribe(native_sink)
    async def writer():
        while True:
            event = await output.get()
            try: await asyncio.to_thread(write_frame, sys.__stdout__.buffer, event)
            finally: output.task_done()
    async def lease_watch():
        while not lease.expired():
            await asyncio.sleep(min(lease.remaining(), 0.1))
        task.cancel()
    async def monitor():
        while True:
            await asyncio.sleep(2)
            await adapter.check_connection()
    async def serve():
        await asyncio.wait_for(adapter.start(), lease.remaining())
        writer_task = asyncio.create_task(writer())
        monitor_task = asyncio.create_task(monitor())
        lease_task = asyncio.create_task(lease_watch())
        def stop_on_failure(child):
            if not child.cancelled() and child.exception() is not None:
                task.cancel()
        writer_task.add_done_callback(stop_on_failure)
        monitor_task.add_done_callback(stop_on_failure)
        try:
            while True:
                request = await read_async_frame(reader)
                if request is None: return
                event = await runtime.handle(request)
                enqueue(event)
                # Propagate a broken output pipe rather than silently dropping completion.
                if writer_task.done(): await writer_task
        finally:
            for child in (writer_task, monitor_task, lease_task): child.cancel()
            await asyncio.gather(writer_task, monitor_task, lease_task, return_exceptions=True)
    try:
        # Hard provisioned-session lifetime until durable lease renewal is implemented.
        await asyncio.wait_for(serve(), ttl)
    finally:
        transport.close()
        try:
            await asyncio.wait_for(runtime.close(), 5)
        finally:
            await asyncio.wait_for(adapter.close(), 5)

if __name__ == '__main__':
    try:
        # Native libraries sometimes print banners: stdout is protocol-only.
        with contextlib.redirect_stdout(sys.stderr):
            asyncio.run(run())
    except BaseException:
        print('VOICE_CHILD_STOPPED_OR_FAILED', file=sys.stderr)
        sys.exit(1)
