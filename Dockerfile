FROM node:22-alpine AS deps

WORKDIR /opt/5stack

COPY package.json yarn.lock .yarnrc.yml ./

RUN corepack enable && corepack prepare 

RUN yarn install --immutable

FROM node:22-alpine AS builder

WORKDIR /opt/5stack

COPY --from=deps /opt/5stack/node_modules ./node_modules
COPY . .

RUN corepack enable && corepack prepare

# Node caps its default old-space at ~4GB, and this build peaks around 5.7GB
# (measured), so it OOMs with "Ineffective mark-compacts near heap limit".
# CI runners have 16GB, so give the build room instead of letting it run at
# the edge of the default ceiling.
ENV NODE_OPTIONS=--max-old-space-size=8192

RUN yarn build

FROM node:22-alpine

WORKDIR /opt/5stack

COPY --from=builder /opt/5stack/.output  .

ENV HOST=0.0.0.0
EXPOSE 3000

CMD [ "node", "server/index.mjs" ]