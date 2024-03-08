FROM node:18 as builder

WORKDIR /opt/stack5

COPY . .

RUN yarn install \
  --prefer-offline \
  --frozen-lockfile \
  --non-interactive \
  --production=false

RUN yarn build

FROM node:18

WORKDIR /opt/stack5

COPY --from=builder /opt/stack5/.output  .

ENV HOST 0.0.0.0
EXPOSE 3000

CMD [ "node", ".output/server/index.mjs" ]