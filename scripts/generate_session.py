"""Run locally with the selected Kurigram environment. Never send credentials in chat."""
import asyncio
import getpass
import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1] / 'apps' / 'voice-engine'))
from session_file import save_session

async def main():
    from pyrogram import Client
    output = pathlib.Path('.env.assistant')
    if output.exists():
        raise FileExistsError('OUTPUT_EXISTS')
    api_id = input('Telegram API ID: ').strip()
    if not api_id.isdecimal() or int(api_id) <= 0:
        raise ValueError('API_ID_INVALID')
    api_hash = getpass.getpass('Telegram API hash: ').strip()
    if len(api_hash) != 32 or any(c not in '0123456789abcdefABCDEF' for c in api_hash):
        raise ValueError('API_HASH_INVALID')
    phone = getpass.getpass('Dedicated assistant phone (with country code): ').strip()
    password = getpass.getpass('Assistant 2FA password (empty if none): ')
    client = Client('assistant-provisioning', api_id=int(api_id), api_hash=api_hash,
                    phone_number=phone, password=password or None,
                    phone_code=lambda: getpass.getpass('Telegram login code: '),
                    in_memory=True, no_updates=True)
    async with client:
        me = await client.get_me()
        if me.is_bot:
            raise ValueError('USER_ACCOUNT_REQUIRED')
        save_session(output, await client.export_session_string())
    print('Saved .env.assistant with owner-only permissions. Keep this file secret.')

if __name__ == '__main__':
    try:
        asyncio.run(main())
    except (Exception, KeyboardInterrupt):
        # Raw API errors may include private account data. Never print tracebacks here.
        print('SESSION_PROVISIONING_FAILED: check local credentials/network and output-file existence.', file=sys.stderr)
        sys.exit(1)
