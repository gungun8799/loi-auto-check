# ─── Use a lean Node image with Debian under the hood ────────────────────────
FROM node:20-slim

# ─── Install Chromium (and its runtime deps) ────────────────────────────────
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
      chromium \
      ca-certificates \
      fonts-liberation \
      libasound2 \
      libatk1.0-0 \
      libc6 \
      libcairo2 \
      libgbm1 \
      libgtk-3-0 \
      libnss3 \
      libx11-xcb1 \
      libxcomposite1 \
      libxdamage1 \
      libxext6 \
      libxfixes3 \
      libxrandr2 \
      libxss1 \
      libxtst6 \
      wget \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

# ─── Point Puppeteer at our system Chromium rather than downloading its own ─
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

# ─── Create app dir & install deps ──────────────────────────────────────────
WORKDIR /usr/src/app
COPY package*.json ./
# this will run your "postinstall": "npx puppeteer install" too
RUN npm ci

# ─── Copy rest of the code & build ─────────────────────────────────────────
COPY . .

# ─── Expose your backend port & start ───────────────────────────────────────
EXPOSE 5001
CMD ["npm", "start"]