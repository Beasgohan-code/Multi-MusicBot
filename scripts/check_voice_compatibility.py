"""Offline constructor probe. No network login and no real account credentials."""
import argparse
import sys

parser = argparse.ArgumentParser()
parser.add_argument('--client', choices=['wzgram', 'kurigram'], required=True)
args = parser.parse_args()
try:
    if args.client == 'wzgram':
        from wzgram import Client
    else:
        from pyrogram import Client
    from pytgcalls import PyTgCalls
    client = Client('offline-probe', api_id=12345, api_hash='0' * 32, in_memory=True, no_updates=True)
    engine = PyTgCalls(client)
except (ImportError, RuntimeError) as error:
    # Only classify exception, never print raw exception messages that may include session details.
    print(f'CONSTRUCTOR_INCOMPATIBLE:{type(error).__name__}', file=sys.stderr)
    sys.exit(1)
print('CONSTRUCTOR_COMPATIBLE: live playback NOT tested')
