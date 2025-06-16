# ─── Base image with Node.js ────────────────────────────────────────────────
FROM node:18-slim

# ─── Install Chrome Stable ──────────────────────────────────────────────────
RUN apt-get update && apt-get install -y \
      wget gnupg ca-certificates \
    && wget -q -O - https://dl.google.com/linux/linux_signing_key.pub \
        | apt-key add - \
    && echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" \
        > /etc/apt/sources.list.d/google-chrome.list \
    && apt-get update && apt-get install -y \
      google-chrome-stable \
    && rm -rf /var/lib/apt/lists/*

# ─── Tell Puppeteer where to find Chrome ────────────────────────────────────
# This lets your code use the system Chrome you just installed.
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable

# ─── App setup ───────────────────────────────────────────────────────────────
WORKDIR /usr/src/app

# Copy package.json & install deps (including Puppeteer)
COPY package*.json ./
RUN npm ci --production

# ─── Force Puppeteer to install its bundled Chromium ────────────────────────
# (Puppeteer won’t download it inside Docker unless you explicitly ask.)
RUN npx puppeteer install

# ─── Copy application code ───────────────────────────────────────────────────
COPY . .

# ─── Create runtime directories ───────────────────────────────────────────────
RUN mkdir -p contracts processed tmp_uploads \
  && chmod -R 755 contracts processed tmp_uploads \
  && chown -R node:node contracts processed tmp_uploads

USER node

EXPOSE 5001
CMD ["node", "server.js"]