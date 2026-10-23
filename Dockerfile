FROM node:24.22.1-alpine AS deps

WORKDIR /opt/5stack

COPY package.json yarn.lock .yarnrc.yml ./
COPY .yarn/patches ./.yarn/patches

RUN corepack enable && corepack prepare 

RUN yarn install --immutable

FROM node:24.22.1-alpine AS builder

WORKDIR /opt/5stack

COPY --from=deps /opt/5stack/node_modules ./node_modules
COPY . .

RUN corepack enable && corepack prepare

# Node's default old-space (~4GB) is below this build's peak (~4.9GB with the
# locales emitted as JSON.parse, measured 2026-10-23). 12GB keeps headroom on
# the 16GB CI runners.
ENV NODE_OPTIONS=--max-old-space-size=12288

RUN yarn build

FROM node:24.22.1-alpine

RUN apk upgrade --no-cache ca-certificates-bundle

WORKDIR /opt/5stack

COPY --from=builder /opt/5stack/.output  .

ENV HOST=0.0.0.0
EXPOSE 3000

CMD [ "node", "server/index.mjs" ]