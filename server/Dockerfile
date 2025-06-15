# ─────────────────────────────────────────────────────────────────────────────
# Use Puppeteer’s pre-baked image so Chrome’s already installed
# ─────────────────────────────────────────────────────────────────────────────
FROM ghcr.io/puppeteer/puppeteer:19.7.2

# Skip downloading Chromium again and point to the system Chrome
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable

# Set your working directory
WORKDIR /usr/src/app

# Copy package.json, install deps
COPY package*.json ./
RUN npm ci

# Copy the rest of your code
COPY . .

# Start your server
CMD ["node", "server.js"]