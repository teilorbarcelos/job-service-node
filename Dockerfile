FROM oven/bun:1.1-alpine AS base
WORKDIR /app

FROM base AS install
RUN mkdir -p /temp/dev
COPY package.json package-lock.json bun.lockb* /temp/dev/
RUN cd /temp/dev && bun install --frozen-lockfile

RUN mkdir -p /temp/prod
COPY package.json package-lock.json bun.lockb* /temp/prod/
RUN cd /temp/prod && bun install --production --frozen-lockfile

FROM base AS prerelease
COPY --from=install /temp/dev/node_modules node_modules
COPY . .
RUN bunx prisma generate --schema=./prisma/main/schema.prisma

FROM base AS release
COPY --from=install /temp/prod/node_modules node_modules
COPY --from=prerelease /app/src ./src
COPY --from=prerelease /app/prisma ./prisma
COPY --from=prerelease /app/package.json .

USER bun
CMD [ "bun", "run", "src/server.ts" ]
