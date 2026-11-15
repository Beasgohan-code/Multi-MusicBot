"""Private IPC framing only. This module does not claim a connected voice engine."""
import json
import re

MAX_FRAME_BYTES = 65536
OPERATIONS = {'health', 'prepare/join', 'start-local-media', 'pause', 'resume', 'switch-local-media', 'stop', 'leave', 'reconcile', 'renew'}

def _read_exact(stream, length):
    chunks = bytearray()
    while len(chunks) < length:
        chunk = stream.read(length - len(chunks))
        if not chunk:
            raise ValueError('FRAME_INVALID')
        chunks.extend(chunk)
    return bytes(chunks)

def read_frame(stream):
    first = stream.read(1)
    if not first:
        return None
    try:
        length = int.from_bytes(first + _read_exact(stream, 3), 'big')
        if not 0 < length <= MAX_FRAME_BYTES:
            raise ValueError()
        return json.loads(_read_exact(stream, length).decode('utf-8'), parse_constant=lambda _: (_ for _ in ()).throw(ValueError()))
    except (ValueError, UnicodeError):
        raise ValueError('FRAME_INVALID') from None

def write_frame(stream, value):
    try:
        body = json.dumps(value, ensure_ascii=False, allow_nan=False, separators=(',', ':')).encode('utf-8')
        if not 0 < len(body) <= MAX_FRAME_BYTES:
            raise ValueError()
    except (ValueError, TypeError):
        raise ValueError('FRAME_INVALID') from None
    stream.write(len(body).to_bytes(4, 'big') + body)
    stream.flush()

def validate_request(value):
    def matches(pattern, v):
        return isinstance(v, str) and re.fullmatch(pattern, v) is not None
    keys = {'protocolVersion', 'requestId', 'botId', 'chatId', 'sessionId', 'assistantLeaseGeneration', 'expectedRevision', 'operation', 'payload'}
    valid = isinstance(value, dict) and set(value) == keys
    if valid:
        valid = (type(value['protocolVersion']) is int and value['protocolVersion'] == 1
                 and matches(r'[A-Za-z0-9_-]{1,128}', value['requestId'])
                 and matches(r'[A-Za-z0-9_-]{1,128}', value['sessionId'])
                 and matches(r'[1-9][0-9]{0,19}', value['botId'])
                 and matches(r'-?[1-9][0-9]{0,19}', value['chatId'])
                 and type(value['assistantLeaseGeneration']) is int and 1 <= value['assistantLeaseGeneration'] <= 9007199254740991
                 and type(value['expectedRevision']) is int and 0 <= value['expectedRevision'] <= 9007199254740991
                 and isinstance(value['operation'], str) and value['operation'] in OPERATIONS
                 and isinstance(value['payload'], dict))
    if valid:
        payload = value['payload']
        if value['operation'] in {'start-local-media', 'switch-local-media'}:
            valid = set(payload) == {'mediaHandle'} and matches(r'[A-Za-z0-9_-]{1,128}', payload['mediaHandle'])
        elif value['operation'] == 'renew':
            valid = set(payload) == {'leaseMs'} and type(payload['leaseMs']) is int and 100 <= payload['leaseMs'] <= 60000
        else:
            valid = not payload
    if not valid:
        raise ValueError('REQUEST_INVALID')
    return value
