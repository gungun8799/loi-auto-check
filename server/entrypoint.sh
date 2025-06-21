#!/usr/bin/env bash
set -e

# 1) Launch Xvfb on display 99
Xvfb :99 -screen 0 1280x720x24 &

# 2) Point Chrome/Puppeteer at that display
export DISPLAY=:99

# 3) Now exec Node as the main process
exec node server.js