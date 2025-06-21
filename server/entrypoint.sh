#!/usr/bin/env bash
set -e

# 1) Ensure X11 socket dir exists (in case /tmp was reset)
mkdir -p /tmp/.X11-unix
chmod 1777 /tmp/.X11-unix

# 2) Start Xvfb on :99 in the background
Xvfb :99 -screen 0 1280x720x24 &

# 3) Tell Chrome/Puppeteer to use that display
export DISPLAY=:99

# 4) Exec the CMD (node server.js) as PID 1 under Xvfb
exec "$@"