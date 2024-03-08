FROM node:18 as builder

WORKDIR /opt/stack5

COPY . .

RUN yarn install \
  --prefer-offline \
  --frozen-lockfile \
  --non-interactive \
  --production=false

RUN yarn build

RUN rm -rf node_modules && \
  NODE_ENV=production yarn install \
  --prefer-offline \
  --pure-lockfile \
  --non-interactive \
  --production=true

FROM node:lts

WORKDIR /opt/stack5

COPY --from=builder /opt/stack5  .

ENV HOST 0.0.0.0
EXPOSE 3000

CMD [ "node", ".output/server/index.mjs" ]