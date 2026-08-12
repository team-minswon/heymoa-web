#!/usr/bin/env bash
# 말로만 금지돼 있던 셋을 실제로 막습니다. 경로로 판정 가능한 것만 담습니다.
#
#   middleware.ts          proxy.ts와 충돌해 404 루프가 됩니다
#   lib/api/generated/**   orval 산출물입니다. 손으로 고치면 다음 생성에 사라집니다
#   openapi3.yml           server 계약의 미러입니다. 원본에서 다시 복사해야 합니다
#
# PreToolUse(Write|Edit)로 걸립니다. 종료 코드 2 = 도구 호출 차단, stderr가 이유로 전달됩니다.
#
# 탈출구는 열려 있습니다 — 이 hook은 Write·Edit만 봅니다. `pnpm orval` 재생성이나
# 미러 재복사는 Bash라 지나갑니다. 막히는 것은 에이전트가 손으로 고치는 경우뿐입니다.
set -uo pipefail

payload=$(cat)

root=${CLAUDE_PROJECT_DIR:-$PWD}

# 레포 루트 기준 상대 경로로 **정규화해서** 받습니다. 문자열을 잘라내면
# `./openapi3.yml`이나 `app/../middleware.ts` 같은 별칭이 case를 그냥 지나갑니다.
rel=$(printf '%s' "$payload" | ROOT="$root" node -e '
const path = require("path");
let s = "";
process.stdin.on("data", (c) => (s += c));
process.stdin.on("end", () => {
  let p = "";
  try {
    p = JSON.parse(s).tool_input?.file_path ?? "";
  } catch {}
  const root = process.env.ROOT;
  // 레포 밖이면 ".."로 시작해 아래 case 어디에도 안 걸립니다
  process.stdout.write(p ? path.relative(root, path.resolve(root, p)) : "");
});
' 2>/dev/null) || exit 0

[ -n "$rel" ] || exit 0

# Next는 확장자를 안 보고 **basename**으로 판정합니다 — 루트나 src/ 바로 아래에서
# `path.parse(f).name === "middleware"`면 잡습니다(`lib/constants.js`의 MIDDLEWARE_FILENAME).
# 그래서 .js·.mjs·.tsx 전부 걸어야 하고, 반대로 `middleware.test.ts`는 name이
# "middleware.test"라 Next가 안 잡으므로 여기서도 통과시킵니다.
base=${rel##*/}
case "$rel" in
*/*) dir=${rel%/*} ;;
*) dir="" ;;
esac
if [ "${base%.*}" = "middleware" ] && [ "$base" != "middleware" ] &&
    { [ "$dir" = "" ] || [ "$dir" = "src" ]; }; then
    echo "middleware 파일은 만들 수 없습니다: $rel" >&2
    echo "이 레포의 미들웨어는 proxy.ts입니다. 둘이 같이 있으면 Next가 빌드를 끊습니다(E900)." >&2
    exit 2
fi

case "$rel" in
lib/api/generated/*)
    echo "생성 파일은 편집할 수 없습니다: $rel" >&2
    echo "openapi3.yml을 갱신하고 'pnpm orval'로 다시 만드세요. 손으로 고치면 다음 생성에 사라집니다." >&2
    exit 2
    ;;
openapi3.yml)
    echo "openapi3.yml은 손으로 고칠 수 없습니다: $rel" >&2
    echo "heymoa-server 계약의 미러입니다. docs repo origin/main에서 다시 복사하고 /internal/** 경로를 제거하세요." >&2
    echo "어느 파일이 원본인지는 docs repo의 INDEX.md가 가리킵니다." >&2
    exit 2
    ;;
esac

exit 0
