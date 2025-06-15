# ── 1) Base image with Node 18
FROM node:18-slim

# ── 2) Install Chromium (for Puppeteer)
RUN apt-get update \
 && apt-get install -y chromium-browser \
 && rm -rf /var/lib/apt/lists/*

# ── 3) Set the working directory
WORKDIR /usr/src/app

# ── 4) Copy package manifests & install deps
COPY package*.json ./
RUN npm install

# ── 5) Copy the rest of your server code
COPY . .

# ── 6) Tell Puppeteer where Chrome lives
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser
# ── 7) Expose your port
EXPOSE 5001

# ── 8) Start your app
CMD ["node", "server.js"]