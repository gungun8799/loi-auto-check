FROM node:18-alpine

# set your working dir
WORKDIR /usr/src/app

# copy package manifest first so we can npm install 
COPY package*.json ./

# install deps
RUN npm ci --production

# copy the rest of the code
COPY . .

# pre-create the directories you’ll need at runtime
RUN mkdir -p contracts processed \
 && chmod -R 755 contracts processed \
 # if you switch to the `node` user below, make sure it's the owner:
 && chown -R node:node contracts processed

# switch away from root for best practice
USER node

# expose + start
EXPOSE 5001
CMD ["node", "server.js"]