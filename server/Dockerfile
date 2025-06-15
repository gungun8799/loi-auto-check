# ─── Dockerfile ─────────────────────────────────────────────────────
FROM node:18-alpine

# install Chromium & necessary fonts/libraries for Puppeteer
RUN apk add --no-cache \
      chromium \
      nss \
      freetype \
      harfbuzz \
      ca-certificates \
      ttf-freefont

# set your working dir
WORKDIR /usr/src/app

# copy package manifest first so we can npm install 
COPY package*.json ./

# install only prod deps
RUN npm ci --production

# copy the rest of the code
COPY . .

# pre-create the directories you’ll need at runtime and make them writable
RUN mkdir -p contracts processed \
 && chown -R node:node contracts processed

# switch away from root for best practice
USER node

# tell Puppeteer where to find Chromium
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

# expose port and start your server
EXPOSE 5001
CMD ["node", "server.js"]
# ─────────────────────────────────────────────────────────────────────