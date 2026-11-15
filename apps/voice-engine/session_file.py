"""Exclusive, owner-readable local session provisioning output."""
import os
import re

def save_session(path, session):
    if not isinstance(session, str) or re.fullmatch(r'[A-Za-z0-9_=-]{1,8192}', session) is None:
        raise ValueError('SESSION_INVALID')
    # O_EXCL prevents overwriting existing credentials or following a symlink.
    fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(fd, 'w', encoding='utf-8') as stream:
        stream.write(f'ASSISTANT_SESSION={session}\n')
        stream.flush()
        os.fsync(stream.fileno())
