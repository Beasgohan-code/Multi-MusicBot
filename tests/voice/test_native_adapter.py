import pathlib
import sys
import unittest
from unittest.mock import AsyncMock, Mock
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[2] / 'apps' / 'voice-engine'))
from native_adapter import NativeAdapter

class AdapterTests(unittest.IsolatedAsyncioTestCase):
    async def test_real_api_contract_disables_call_creation_and_video(self):
        client = Mock(start=AsyncMock(), stop=AsyncMock())
        engine = Mock(start=AsyncMock(), play=AsyncMock(), pause=AsyncMock(return_value=True), resume=AsyncMock(return_value=True), leave_call=AsyncMock())
        stream = Mock(return_value='stream')
        config = Mock(return_value='config')
        adapter = NativeAdapter(client, engine, stream, config, 'ignore-video')
        await adapter.start()
        client.start.assert_awaited_once(); engine.start.assert_awaited_once()
        await adapter.play(-1001, pathlib.Path('/trusted/a.wav'))
        stream.assert_called_once_with(pathlib.Path('/trusted/a.wav'), video_flags='ignore-video')
        config.assert_called_with(auto_start=False)
        engine.play.assert_awaited_with(-1001, 'stream', config='config')
        self.assertTrue(await adapter.pause(-1001)); self.assertTrue(await adapter.resume(-1001))
        await adapter.leave(-1001); engine.leave_call.assert_awaited_once_with(-1001)
        await adapter.close(); client.stop.assert_awaited_once()
    async def test_engine_start_failure_disconnects_client(self):
        client = Mock(start=AsyncMock(), stop=AsyncMock())
        engine = Mock(start=AsyncMock(side_effect=RuntimeError('native failure')))
        adapter = NativeAdapter(client, engine, Mock(), Mock(), None)
        with self.assertRaises(RuntimeError): await adapter.start()
        client.stop.assert_awaited_once()

class InstalledLibraryTests(unittest.IsolatedAsyncioTestCase):
    async def test_factory_with_installed_kurigram_never_prompts(self):
        import importlib.util
        if importlib.util.find_spec('pyrogram') is None:
            self.skipTest('Run with the isolated Kurigram environment for native constructor coverage')
        from native_adapter import create_adapter
        adapter = create_adapter(12345, '0' * 32, '')
        with self.assertRaisesRegex(RuntimeError, 'SESSION_NOT_AUTHORIZED'):
            await adapter.client.authorize()

    async def test_real_update_types_filter_audio_and_disconnect(self):
        import importlib.util
        if importlib.util.find_spec('pyrogram') is None: self.skipTest('isolated native environment required')
        from native_adapter import create_adapter
        from pytgcalls.types import StreamEnded, ChatUpdate, Device
        adapter = create_adapter(12345, '0' * 32, '')
        sink = AsyncMock()
        adapter.subscribe(sink)
        await adapter.handle_update(None, StreamEnded(-1001, StreamEnded.Type.VIDEO, Device.CAMERA))
        sink.assert_not_awaited()
        await adapter.handle_update(None, StreamEnded(-1001, StreamEnded.Type.AUDIO, Device.MICROPHONE))
        sink.assert_awaited_with(-1001, 'media_ended')
        await adapter.handle_update(None, ChatUpdate(-1001, ChatUpdate.Status.KICKED))
        sink.assert_awaited_with(-1001, 'disconnected')

    async def test_native_call_snapshot_detects_missing_call(self):
        import importlib.util
        if importlib.util.find_spec('pyrogram') is None: self.skipTest('isolated native environment required')
        from native_adapter import create_adapter
        adapter = create_adapter(12345, '0' * 32, '')
        sink = AsyncMock(); adapter.subscribe(sink)
        adapter.observed_chat = -1001
        await adapter.check_connection()  # Actual ntgcalls empty call snapshot, no Telegram login.
        sink.assert_awaited_once_with(-1001, 'disconnected')
