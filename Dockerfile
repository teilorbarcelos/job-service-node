FROM oven/bun:1.1-alpine AS base
WORKDIR /app

# Install dependencies into temp directory
# This will cache them and speed up future builds
FROM base AS install
RUN mkdir -p /temp/dev
COPY package.json package-lock.json bun.lockb* /temp/dev/
RUN cd /temp/dev && bun install --frozen-lockfile

# Install with --production (exclude devDependencies)
RUN mkdir -p /temp/prod
COPY package.json package-lock.json bun.lockb* /temp/prod/
RUN cd /temp/prod && bun install --production --frozen-lockfile

# Copy node_modules from temp directory
# Then copy all (non-ignored) project files into the image
FROM base AS prerelease
COPY --from=install /temp/dev/node_modules node_modules
COPY . .

# [ENV_WARNING] Assuming you have a bun command for building or compiling TS, setup appropriately
# e.g., if you compile TypeScript to dist/ :
# RUN bun run build

# If not, and running directly via tsx / bun, we skip compilation
RUN bunx prisma generate --schema=./prisma/main/schema.prisma

# Final production stage
FROM base AS release
COPY --from=install /temp/prod/node_modules node_modules
COPY --from=prerelease /app/src ./src
COPY --from=prerelease /app/prisma ./prisma
COPY --from=prerelease /app/package.json .

# Generate prisma clients for both schemas
RUN bunx prisma generate --schema=./prisma/main/schema.prisma && \
    bunx prisma generate --schema=./prisma/audit/audit.prisma

# Install healthcheck tool
RUN apk add --no-cache wget

# Set appropriate user and group
USER bun
EXPOSE 8888

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s CMD wget -qO- http://localhost:8888/liveness || exit 1

CMD [ "bun", "run", "src/server.ts" ]
