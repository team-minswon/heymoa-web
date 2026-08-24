# heymoa-web. public edge라 TLS 종단과 CORS는 앞단이 맡고 여기는 Next 서버만 띄운다.
#
# **빌드 타임에 굳는 값이 있다.** `NEXT_PUBLIC_*`은 클라이언트 번들에 박히므로 런타임
# 환경변수로 못 바꾼다. 통합 환경마다 이미지를 다시 빌드하거나 build arg로 넘긴다.

FROM node:24-bookworm-slim AS deps
WORKDIR /app
RUN corepack enable
# 의존성 레이어를 소스와 분리해 캐시를 살린다.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

FROM node:24-bookworm-slim AS build
WORKDIR /app
RUN corepack enable
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# 브라우저 번들에 박히는 값. compose가 build arg로 넘긴다.
ARG NEXT_PUBLIC_API_BASE_URL
ARG NEXT_PUBLIC_API_MOCKING
ENV NEXT_PUBLIC_API_BASE_URL=$NEXT_PUBLIC_API_BASE_URL
ENV NEXT_PUBLIC_API_MOCKING=$NEXT_PUBLIC_API_MOCKING
RUN pnpm build

FROM node:24-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# standalone은 서버와 필요한 node_modules만 담는다. public과 static은 따로 옮긴다.
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public

RUN useradd --uid 10001 --create-home app && chown -R app:app /app
USER app

EXPOSE 3000
CMD ["node", "server.js"]
