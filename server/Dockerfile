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

# ─── Tell Puppeteer where to find it ────────────────────────────────────────
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable

# ─── App setup ───────────────────────────────────────────────────────────────
WORKDIR /usr/src/app
COPY package*.json ./
RUN npm ci --production
COPY . .

# ─── Create storage directories ──────────────────────────────────────────────
RUN mkdir -p contracts processed tmp_uploads \
  && chmod -R 755 contracts processed tmp_uploads \
  && chown -R node:node contracts processed tmp_uploads

USER node

EXPOSE 5001
CMD ["node", "server.js"]