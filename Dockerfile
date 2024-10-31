FROM node:22-alpine as deps

WORKDIR /opt/5stack

COPY package.json yarn.lock ./

RUN yarn install \
  --prefer-offline \
  --frozen-lockfile \
  --non-interactive \
  --production=false

FROM node:22-alpine as builder

WORKDIR /opt/5stack

COPY --from=deps /opt/5stack/node_modules ./node_modules
COPY . .

RUN yarn build

FROM node:22-alpine

WORKDIR /opt/5stack

COPY --from=builder /opt/5stack/.output  .

ENV HOST 0.0.0.0
EXPOSE 3000

CMD [ "node", "server/index.mjs" ]