FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY vendor/playeon/playeon-web/package*.json ./
RUN npm ci
COPY vendor/playeon/playeon-web/ ./
# Only a PUBLIC origin is a build argument. No credentials belong in ARG/NEXT_PUBLIC_*.
ARG NEXT_PUBLIC_ROOM_WS_URL
ARG NEXT_PUBLIC_BOT_USERNAME
ENV NEXT_PUBLIC_ROOM_WS_URL=$NEXT_PUBLIC_ROOM_WS_URL NEXT_PUBLIC_BOT_USERNAME=$NEXT_PUBLIC_BOT_USERNAME NEXT_TELEMETRY_DISABLED=1
RUN node -e 'try{const u=new URL(process.env.NEXT_PUBLIC_ROOM_WS_URL);if(u.protocol!=="https:"||u.username||u.password||u.pathname!=="/"||u.search||u.hash||!/^[A-Za-z][A-Za-z0-9_]{4,31}$/.test(process.env.NEXT_PUBLIC_BOT_USERNAME||""))throw new Error();}catch{console.error("PUBLIC_BUILD_CONFIG_INVALID");process.exit(1)}' \
    && npm run build

FROM node:22-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends tini ca-certificates \
    && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1
WORKDIR /app
COPY --from=build --chown=node:node /app /app
COPY vendor/playeon/LICENSE vendor/playeon/UPSTREAM.json ./
COPY deploy/render/validate.mjs deploy/render/start.sh /opt/deploy/
USER node
STOPSIGNAL SIGTERM
ENTRYPOINT ["/usr/bin/tini", "--", "/bin/sh", "/opt/deploy/start.sh", "web"]
