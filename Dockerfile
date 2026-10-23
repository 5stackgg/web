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

# The client build leaves ~6.8GB of live heap (measured 2026-10-23), which an
# 8GB old-space can no longer fit through the Nitro and PWA steps after it
# ("Ineffective mark-compacts near heap limit"). Peak RSS with a 14GB cap was
# 9.3GB and CI runners have 16GB.
ENV NODE_OPTIONS=--max-old-space-size=12288

RUN yarn build

FROM node:24.22.1-alpine

RUN apk upgrade --no-cache ca-certificates-bundle

WORKDIR /opt/5stack

COPY --from=builder /opt/5stack/.output  .

ENV HOST=0.0.0.0
EXPOSE 3000

CMD [ "node", "server/index.mjs" ]