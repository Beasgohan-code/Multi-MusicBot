# Operator-only Phase 0 image. No public Telegram handlers/onboarding yet.
# Record resolved base digests/FFmpeg version with each deployment measurement.
FROM node:22-bookworm-slim AS node-build
WORKDIR /build
COPY package.json package-lock.json tsconfig.json ./
RUN npm ci
COPY apps ./apps
COPY packages ./packages
COPY scripts ./scripts
RUN npm run build && npm prune --omit=dev

FROM python:3.11-slim-bookworm AS runtime
RUN apt-get update \
    && apt-get install -y --no-install-recommends ffmpeg tini ca-certificates libstdc++6 \
    && rm -rf /var/lib/apt/lists/*
COPY --from=node-build /usr/local/bin/node /usr/local/bin/node
ENV NODE_ENV=production \
    PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    VOICE_PYTHON=/opt/voice/bin/python
WORKDIR /app
COPY apps/voice-engine/requirements-kurigram.lock.txt /tmp/requirements-kurigram.lock.txt
RUN python -m venv /opt/voice \
    && /opt/voice/bin/python -m pip install --no-cache-dir -r /tmp/requirements-kurigram.lock.txt \
    && rm /tmp/requirements-kurigram.lock.txt
COPY --from=node-build /build/node_modules ./node_modules
COPY --from=node-build /build/package.json ./package.json
COPY --from=node-build /build/dist/apps ./dist/apps
COPY --from=node-build /build/dist/packages ./dist/packages
COPY --from=node-build /build/dist/scripts ./dist/scripts
COPY apps/voice-engine/*.py ./apps/voice-engine/
COPY scripts/check_voice_compatibility.py ./scripts/check_voice_compatibility.py
RUN groupadd --gid 10001 app \
    && useradd --uid 10001 --gid app --create-home app \
    && mkdir /media \
    && chown app:app /media
USER app
# Runner exits when its bounded queue is drained; this is not a polling bot.
STOPSIGNAL SIGTERM
ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["node", "dist/scripts/run-playback.js"]
