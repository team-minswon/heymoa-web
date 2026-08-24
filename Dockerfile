# heymoa-web. public edge라 TLS 종단과 CORS는 앞단이 맡고 여기는 Next 서버만 띄운다.
#
# **빌드 타임에 굳는 값이 있다.** `NEXT_PUBLIC_*`은 클라이언트 번들에 박히므로 런타임
# 환경변수로 못 바꾼다. 통합 환경마다 이미지를 다시 빌드하거나 build arg로 넘긴다.

# **pnpm 버전을 고정한다.** corepack 이 다른 버전을 잡으면 `overrides` 를 읽는 자리가 달라져
# (`package.json` 의 `pnpm.overrides` 는 최신 pnpm 이 무시한다) 락파일과 어긋나고
# `--frozen-lockfile` 이 `ERR_PNPM_LOCKFILE_CONFIG_MISMATCH` 로 죽는다. 실제로 밟았다.
FROM node:24-bookworm-slim AS deps
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@11.3.0 --activate
# 의존성 레이어를 소스와 분리해 캐시를 살린다.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

FROM node:24-bookworm-slim AS build
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@11.3.0 --activate
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# 브라우저 번들에 박히는 값. compose가 build arg로 넘긴다.
ARG NEXT_PUBLIC_API_BASE_URL
ARG NEXT_PUBLIC_API_MOCKING
ENV NEXT_PUBLIC_API_BASE_URL=$NEXT_PUBLIC_API_BASE_URL
ENV NEXT_PUBLIC_API_MOCKING=$NEXT_PUBLIC_API_MOCKING
# **`pnpm build` 가 아니라 바이너리를 직접 부른다.** pnpm 은 스크립트 실행 전에 의존성
# 상태를 다시 검사하며 `install` 을 돌리는데, deps 스테이지에서 옮겨온 `node_modules` 와
# 상태 파일이 어긋나 그 재검사가 실패한다. 설치는 이미 끝났으므로 다시 볼 이유가 없다.
RUN ./node_modules/.bin/next build

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
