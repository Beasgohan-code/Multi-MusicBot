#!/bin/sh
# Render's mounted disk hides image-layer ownership. Only initialize that mount;
# the network-facing bot itself runs unprivileged through exec/gosu.
set -eu
mkdir -p /var/data
chown node:node /var/data
exec gosu node /bin/sh /opt/deploy/start.sh bot
