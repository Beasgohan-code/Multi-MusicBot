#!/bin/sh
set -eu
mkdir -p /var/data
chown node:node /var/data
exec gosu node node /opt/deploy/start-full.mjs
