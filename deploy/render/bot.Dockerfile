# Attributed Playeon personal-test service, separate from the root VC prototype.
FROM node:22-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates ffmpeg python3 python3-venv make g++ tini gosu \
    && rm -rf /var/lib/apt/lists/*
RUN python3 -m venv /opt/media \
    && /opt/media/bin/pip install --no-cache-dir yt-dlp==2026.10.26
ENV NODE_ENV=production YTDLP_BIN=/opt/media/bin/yt-dlp
WORKDIR /app
COPY vendor/playeon/playeon-bot/package*.json ./
# Lifecycle scripts build better-sqlite3 if a matching prebuilt is unavailable.
# tsx is retained because the upstream command loader loads TypeScript source.
RUN npm ci --include=dev
COPY vendor/playeon/playeon-bot/src ./src
COPY vendor/playeon/playeon-bot/tsconfig.json ./tsconfig.json
RUN npm run typecheck
COPY vendor/playeon/LICENSE vendor/playeon/UPSTREAM.json ./
COPY deploy/render/validate.mjs deploy/render/start.sh deploy/render/bootstrap-bot.sh /opt/deploy/
RUN mkdir -p /var/data && chown node:node /var/data
STOPSIGNAL SIGTERM
ENTRYPOINT ["/usr/bin/tini", "--", "/bin/sh", "/opt/deploy/bootstrap-bot.sh"]
