import asyncio
import pathlib
import sys
import unittest
from unittest.mock import AsyncMock
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[2] / 'apps' / 'voice-engine'))
from server import read_async_frame, load_settings
from protocol import write_frame
import io
class ServerTests(unittest.IsolatedAsyncioTestCase):
    async def test_async_frames_and_truncation(self):
        stream = io.BytesIO(); write_frame(stream, {'value': 'hello'})
        reader = asyncio.StreamReader(); reader.feed_data(stream.getvalue()); reader.feed_eof()
        self.assertEqual(await read_async_frame(reader), {'value': 'hello'})
        self.assertIsNone(await read_async_frame(reader))
        reader = asyncio.StreamReader(); reader.feed_data(b'\0'); reader.feed_eof()
        with self.assertRaisesRegex(ValueError, 'FRAME_INVALID'): await read_async_frame(reader)
    async def test_settings_fail_without_echoing_values(self):
        with self.assertRaisesRegex(ValueError, '^VOICE_CONFIG_INVALID$'):
            load_settings({'API_HASH': 'super-secret'})
