# ─── Base image with Node.js ────────────────────────────────────────────────
FROM node:18-slim

# ─── Install dependencies for Puppeteer + Chrome Stable ────────────────────
RUN apt-get update && apt-get install -y \
      wget \
      gnupg \
      ca-certificates \
    && wget -q -O - https://dl.google.com/linux/linux_signing_key.pub \
        | apt-key add - \
    && echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" \
        > /etc/apt/sources.list.d/google-chrome.list \
    && apt-get update && apt-get install -y \
      google-chrome-stable \
    && rm -rf /var/lib/apt/lists/*

# ─── Let Puppeteer know where the Chrome binary lives ───────────────────────
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable

# ─── Set working directory ─────────────────────────────────────────────────
WORKDIR /usr/src/app

# ─── Copy package manifests & install only production deps ─────────────────
COPY package*.json ./
RUN npm ci --production

# ─── Copy the rest of your application code ────────────────────────────────
COPY . .

# ─── Pre-create and secure your runtime directories ────────────────────────
RUN mkdir -p contracts processed tmp_uploads \
  && chmod -R 755 contracts processed tmp_uploads \
  && chown -R node:node contracts processed tmp_uploads

# ─── Drop root privileges ──────────────────────────────────────────────────
USER node

# ─── Expose and launch your server ─────────────────────────────────────────
EXPOSE 5001
CMD ["node", "server.js"]