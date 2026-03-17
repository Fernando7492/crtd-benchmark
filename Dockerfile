FROM node:24-trixie-slim AS deps

WORKDIR /app

RUN apt-get update -y \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci


FROM deps AS build

COPY tsconfig.json ./
COPY src ./src

# Prisma schema lives in src/prisma, so generate client before compiling.
RUN npx prisma generate --schema ./src/prisma/schema.prisma
RUN npm run build
RUN npm prune --omit=dev


FROM node:24-trixie-slim AS runtime

WORKDIR /app
ENV NODE_ENV=production

RUN apt-get update -y \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

COPY --from=build /app/package.json ./package.json
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/src/prisma ./src/prisma
COPY certs ./certs

EXPOSE 8080

CMD ["node", "dist/index.js"]
