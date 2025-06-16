# ─── Dockerfile ─────────────────────────────────────────────────────
FROM node:18-alpine

# install Chromium & libraries for Puppeteer
RUN apk add --no-cache \
      chromium \
      nss \
      freetype \
      harfbuzz \
      ca-certificates \
      ttf-freefont

WORKDIR /usr/src/app

# copy package manifest & install prod deps
COPY package*.json ./
RUN npm ci --production

# copy app code
COPY . .

# pre-create and chown all dirs Puppeteer or multer will write into
RUN mkdir -p \
      contracts \
      processed \
      tmp_uploads \
      uploads \
      prompts \
    && chown -R node:node \
      contracts \
      processed \
      tmp_uploads \
      uploads \
      prompts

USER node

# point Puppeteer at Alpine's Chromium
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

EXPOSE 5001
CMD ["node", "server.js"]
# ─────────────────────────────────────────────────────────────────────