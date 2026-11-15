import io
import pathlib
import sys
import unittest
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[2] / 'apps' / 'voice-engine'))
from protocol import read_frame, write_frame, validate_request

REQUEST = dict(protocolVersion=1, requestId='r1', botId='123', chatId='-100123', sessionId='s1', assistantLeaseGeneration=1, expectedRevision=0, operation='pause', payload={})
class ProtocolTests(unittest.TestCase):
    def test_roundtrip_and_eof(self):
        stream = io.BytesIO()
        write_frame(stream, {'text': 'മലയാളം'})
        stream.seek(0)
        self.assertEqual(read_frame(stream), {'text': 'മലയാളം'})
        self.assertIsNone(read_frame(stream))
    def test_invalid_frames(self):
        for data in [b'\0', b'\0\0\0\0', (65537).to_bytes(4, 'big'), b'\0\0\0\x01{', b'\0\0\0\x01\xff']:
            with self.assertRaisesRegex(ValueError, 'FRAME_INVALID'):
                read_frame(io.BytesIO(data))
    def test_request_validation(self):
        self.assertEqual(validate_request(REQUEST), REQUEST)
        for patch in [dict(protocolVersion=True), dict(assistantLeaseGeneration=True), dict(expectedRevision=-1), dict(operation='shell'), dict(payload={'path': '/etc/passwd'}), dict(extra=True), dict(botId=''), dict(operation='start-local-media', payload={'mediaHandle': '../secret'})]:
            with self.assertRaisesRegex(ValueError, 'REQUEST_INVALID'):
                validate_request({**REQUEST, **patch})
