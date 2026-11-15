"""Kurigram/PyTgCalls production calls; dependencies imported only by the factory."""
class NativeAdapter:
    def __init__(self, client, engine, stream_factory, config_factory, ignore_video):
        self.client, self.engine = client, engine
        self.stream_factory, self.config_factory, self.ignore_video = stream_factory, config_factory, ignore_video
        self.started = False
        self.absent_errors = ()
        self.sink = None
        self.observed_chat = None
    def subscribe(self, sink):
        if self.sink is not None: raise RuntimeError('ALREADY_SUBSCRIBED')
        self.sink = sink
        self.engine.add_handler(self.handle_update)
    async def handle_update(self, client, update):
        from pytgcalls.types import StreamEnded, ChatUpdate, Device
        if self.sink is None: return
        if isinstance(update, StreamEnded) and update.stream_type == StreamEnded.Type.AUDIO and update.device == Device.MICROPHONE:
            await self.sink(update.chat_id, 'media_ended')
        elif isinstance(update, ChatUpdate) and update.status & ChatUpdate.Status.LEFT_CALL:
            await self.sink(update.chat_id, 'disconnected')
    async def check_connection(self):
        # PyTgCalls 2.3.3 does not propagate every native transport loss as ChatUpdate.
        if self.observed_chat is None or self.sink is None: return
        try:
            present = self.observed_chat in await self.engine.calls
        except Exception:
            present = False  # Unknown transport state must not look healthy.
        if not present: await self.sink(self.observed_chat, 'disconnected')
    async def start(self):
        await self.client.start()
        try:
            await self.engine.start()
        except BaseException:
            await self.client.stop()
            raise
        self.started = True
    async def play(self, chat, path=None):
        stream = self.stream_factory(path, video_flags=self.ignore_video) if path else None
        await self.engine.play(chat, stream, config=self.config_factory(auto_start=False))
        self.observed_chat = chat
    async def pause(self, chat): return await self.engine.pause(chat)
    async def resume(self, chat): return await self.engine.resume(chat)
    async def leave(self, chat):
        self.observed_chat = None
        try:
            await self.engine.leave_call(chat)
        except self.absent_errors:
            raise RuntimeError('NATIVE_CLEANUP_UNCONFIRMED') from None
    async def close(self):
        if self.started:
            await self.client.stop()
            self.started = False

def create_adapter(api_id, api_hash, session):
    from pyrogram import Client
    from pytgcalls import PyTgCalls
    from pytgcalls.types import MediaStream, GroupCallConfig
    from types import MethodType
    async def refuse_authorization(self, *args, **kwargs):
        # Keep the concrete Client class: PyTgCalls detects its module name.
        # A daemon must never prompt for a phone/code over framed stdin.
        raise RuntimeError('SESSION_NOT_AUTHORIZED')
    client = Client('voice-assistant', api_id=api_id, api_hash=api_hash,
                    session_string=session, in_memory=True)
    client.authorize = MethodType(refuse_authorization, client)
    from pytgcalls.exceptions import NotInCallError, NoActiveGroupCall
    adapter = NativeAdapter(client, PyTgCalls(client), MediaStream, GroupCallConfig, MediaStream.Flags.IGNORE)
    adapter.absent_errors = (NotInCallError, NoActiveGroupCall)
    return adapter
