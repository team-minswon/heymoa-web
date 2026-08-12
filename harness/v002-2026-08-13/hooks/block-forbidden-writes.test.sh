#!/usr/bin/env bash
# block-forbidden-writes.sh 자체 검사. 레포 어디서든 그냥 실행하면 됩니다.
#
#   ./harness/v002-2026-08-13/hooks/block-forbidden-writes.test.sh
#
# 별칭 경로(`./`·`..`·중복 슬래시)로 우회되는 것이 실제 결함이었습니다 (codex 리뷰 2·3회차).
set -uo pipefail

here=$(cd "$(dirname "$0")" && pwd)
hook="$here/block-forbidden-writes.sh"
root=$(cd "$here/../../.." && pwd)

fail=0
check() { # check <기대 exit> <경로>
    local want=$1 path=$2 got
    printf '{"tool_input":{"file_path":"%s"}}' "$path" |
        CLAUDE_PROJECT_DIR="$root" "$hook" >/dev/null 2>&1
    got=$?
    if [ "$got" != "$want" ]; then
        echo "FAIL  $path — exit=$got, 기대=$want" >&2
        fail=1
    fi
}

# 막아야 하는 것 — 절대·상대·`./`·`..`·중복 슬래시, 그리고 Next가 잡는 모든 확장자
for p in \
    "$root/middleware.ts" middleware.ts ./middleware.ts app/../middleware.ts \
    middleware.js middleware.mjs middleware.tsx src/middleware.js \
    src/middleware.ts \
    "$root/lib/api/generated/x.ts" lib/api/generated/x.ts \
    lib//api/generated/../generated/x.ts \
    "$root/openapi3.yml" ./openapi3.yml docs/../openapi3.yml; do
    check 2 "$p"
done

# 지나가야 하는 것 — 비슷하지만 다른 경로, 레포 밖, 평범한 소스
# `middleware.test.ts`는 Next가 basename을 "middleware.test"로 보므로 잡지 않습니다.
# `lib/middleware.ts`도 규약 위치(루트·src/)가 아니라 그냥 파일입니다.
for p in \
    components/ui/button.tsx proxy.ts docs/openapi3.yml \
    middleware.test.ts src/middleware.test.ts lib/middleware.ts \
    lib/api/fetcher.ts /tmp/middleware.ts ../other-repo/middleware.ts; do
    check 0 "$p"
done

# 망가진 입력은 조용히 통과해야 합니다 (hook이 도구를 막아서는 안 됨)
echo 'not json' | CLAUDE_PROJECT_DIR="$root" "$hook" >/dev/null 2>&1 ||
    { echo "FAIL  깨진 JSON에서 0이 아님" >&2; fail=1; }
echo '{}' | CLAUDE_PROJECT_DIR="$root" "$hook" >/dev/null 2>&1 ||
    { echo "FAIL  빈 payload에서 0이 아님" >&2; fail=1; }

[ "$fail" = 0 ] && echo "block-forbidden-writes: 통과"
exit "$fail"
