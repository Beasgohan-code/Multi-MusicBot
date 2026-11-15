import os
import pathlib
import sys
import tempfile
import unittest
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[2] / 'apps' / 'voice-engine'))
from session_file import save_session

class SessionFileTests(unittest.TestCase):
    def test_private_file_and_no_overwrite(self):
        with tempfile.TemporaryDirectory() as directory:
            path = pathlib.Path(directory) / '.env.assistant'
            save_session(path, 'session-secret')
            self.assertEqual(path.read_text(), 'ASSISTANT_SESSION=session-secret\n')
            self.assertEqual(os.stat(path).st_mode & 0o777, 0o600)
            with self.assertRaises(FileExistsError):
                save_session(path, 'replacement')
            self.assertEqual(path.read_text(), 'ASSISTANT_SESSION=session-secret\n')
    def test_rejects_newline_and_empty(self):
        with tempfile.TemporaryDirectory() as directory:
            for session in ['', 'x\nINJECT=1', 'x\rINJECT=1']:
                with self.assertRaisesRegex(ValueError, 'SESSION_INVALID'):
                    save_session(pathlib.Path(directory) / 'secret', session)
